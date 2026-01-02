'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [copied, setCopied] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });

    setApiKeys(data || []);
    setLoading(false);
  };

  const createApiKey = async () => {
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const apiKey = `rmt_${nanoid(32)}`;
    const keyPreview = apiKey.substring(0, 12) + '...';
    const keyHash = await hashApiKey(apiKey);

    const { error } = await supabase.from('api_keys').insert({
      user_id: user.id,
      name: 'My API Key',
      key_hash: keyHash,
      key_preview: keyPreview,
    });

    if (!error) {
      setNewlyCreatedKey(apiKey);
      loadApiKeys();
    }

    setCreating(false);
  };

  const updateKeyName = async (id: string) => {
    if (!editName.trim()) return;

    await supabase
      .from('api_keys')
      .update({ name: editName.trim() })
      .eq('id', id);

    setEditingId(null);
    setEditName('');
    loadApiKeys();
  };

  const revokeApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;

    await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', id);

    loadApiKeys();
  };

  const deleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    await supabase.from('api_keys').delete().eq('id', id);
    loadApiKeys();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">API Keys</h1>
          <p className="text-muted-foreground">
            Manage your API keys for CLI authentication
          </p>
        </div>
        <Button onClick={createApiKey} disabled={creating}>
          {creating ? 'Creating...' : 'Create API Key'}
        </Button>
      </div>

      {newlyCreatedKey && (
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">API Key Created</div>
            <button
              onClick={() => setNewlyCreatedKey(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Copy this key now. You won&apos;t be able to see it again!
          </p>
          <div className="flex items-center gap-2">
            <code className="bg-muted px-4 py-2 rounded font-mono text-sm flex-1 overflow-x-auto">
              {newlyCreatedKey}
            </code>
            <Button variant="secondary" size="sm" onClick={() => copyToClipboard(newlyCreatedKey)}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Set this as an environment variable:
          </p>
          <code className="bg-muted px-4 py-2 rounded font-mono text-sm block mt-2">
            export REMOTO_API_KEY=&quot;{newlyCreatedKey}&quot;
          </code>
        </div>
      )}

      {apiKeys.length > 0 ? (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Name</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Key</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Created</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Last used</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    {editingId === key.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-muted border border-border rounded px-2 py-1 text-sm w-32"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updateKeyName(key.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <Button variant="ghost" size="sm" onClick={() => updateKeyName(key.id)}>Save</Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(key.id); setEditName(key.name); }}
                        className="font-medium hover:text-muted-foreground transition-colors"
                        title="Click to edit"
                      >
                        {key.name}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{key.key_preview}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(key.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      key.is_active ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {key.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {key.is_active && (
                        <Button variant="ghost" size="sm" onClick={() => revokeApiKey(key.id)}>
                          Revoke
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => deleteApiKey(key.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <p className="text-muted-foreground mb-4">You don&apos;t have any API keys yet</p>
          <Button onClick={createApiKey} disabled={creating}>
            Create your first API key
          </Button>
        </div>
      )}
    </div>
  );
}
