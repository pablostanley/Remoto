'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { nanoid } from 'nanoid';

// Hash API key with SHA-256 (matches server-side hashing)
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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

  const createApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Generate a new API key
    const apiKey = `rmt_${nanoid(32)}`;
    const keyPreview = apiKey.substring(0, 12) + '...';

    // Hash the key before storing (SHA-256)
    const keyHash = await hashApiKey(apiKey);

    const { error } = await supabase.from('api_keys').insert({
      user_id: user.id,
      name: newKeyName,
      key_hash: keyHash,
      key_preview: keyPreview,
    });

    if (!error) {
      setNewlyCreatedKey(apiKey);
      setNewKeyName('');
      loadApiKeys();
    }

    setCreating(false);
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
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">API Keys</h1>
          <p className="text-gray-400">
            Manage your API keys for CLI authentication
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Create API Key
        </button>
      </div>

      {/* Newly created key banner */}
      {newlyCreatedKey && (
        <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-green-400 font-medium">
              API Key Created Successfully
            </div>
            <button
              onClick={() => setNewlyCreatedKey(null)}
              className="text-green-400 hover:text-green-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-300 mb-3">
            Copy this key now. You won&apos;t be able to see it again!
          </p>
          <div className="flex items-center gap-2">
            <code className="bg-gray-900 px-4 py-2 rounded font-mono text-sm flex-1 overflow-x-auto">
              {newlyCreatedKey}
            </code>
            <button
              onClick={() => copyToClipboard(newlyCreatedKey)}
              className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded transition-colors"
            >
              Copy
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-3">
            Set this as an environment variable:
          </p>
          <code className="bg-gray-900 px-4 py-2 rounded font-mono text-sm block mt-2 text-green-400">
            export REMOTO_API_KEY=&quot;{newlyCreatedKey}&quot;
          </code>
        </div>
      )}

      {/* API Keys list */}
      {apiKeys.length > 0 ? (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-sm font-medium text-gray-400 px-4 py-3">
                  Name
                </th>
                <th className="text-left text-sm font-medium text-gray-400 px-4 py-3">
                  Key
                </th>
                <th className="text-left text-sm font-medium text-gray-400 px-4 py-3">
                  Created
                </th>
                <th className="text-left text-sm font-medium text-gray-400 px-4 py-3">
                  Last used
                </th>
                <th className="text-left text-sm font-medium text-gray-400 px-4 py-3">
                  Status
                </th>
                <th className="text-right text-sm font-medium text-gray-400 px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr
                  key={key.id}
                  className="border-b border-gray-800 last:border-0"
                >
                  <td className="px-4 py-3 font-medium">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-400">
                    {key.key_preview}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(key.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {key.last_used_at
                      ? new Date(key.last_used_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        key.is_active
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {key.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {key.is_active && (
                        <button
                          onClick={() => revokeApiKey(key.id)}
                          className="text-yellow-400 hover:text-yellow-300 text-sm"
                        >
                          Revoke
                        </button>
                      )}
                      <button
                        onClick={() => deleteApiKey(key.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 text-center">
          <div className="text-gray-400 mb-4">
            You don&apos;t have any API keys yet
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Create your first API key
          </button>
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md border border-gray-800">
            <h2 className="text-xl font-bold mb-4">Create API Key</h2>
            <form onSubmit={createApiKey}>
              <div className="mb-4">
                <label
                  htmlFor="keyName"
                  className="block text-sm font-medium text-gray-400 mb-1"
                >
                  Key name
                </label>
                <input
                  id="keyName"
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., MacBook Pro"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  A friendly name to help you identify this key
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newKeyName}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
