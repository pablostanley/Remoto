'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';

interface Session {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(100);

    setSessions(data || []);
    setLoading(false);
  };

  const endSession = async (sessionId: string) => {
    if (!confirm('End this session? The CLI will be disconnected.')) return;

    await supabase
      .from('sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    loadSessions();
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Delete this session from history?')) return;

    await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId);

    loadSessions();
  };

  const reconnectSession = (sessionId: string) => {
    // Note: This would need the session token which we don't store
    // For now, show a message
    alert('To reconnect, scan the QR code from the CLI again.');
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Sessions</h1>
        <p className="text-muted-foreground">View and manage your session history</p>
      </div>

      {sessions.length > 0 ? (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Session ID</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Started</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Duration</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-sm">{session.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(session.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {session.duration_seconds ? formatDuration(session.duration_seconds) :
                     session.status === 'active' ? 'ongoing' : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      session.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'
                    }`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {session.status === 'active' && (
                        <Button variant="ghost" size="sm" onClick={() => endSession(session.id)}>
                          End
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => deleteSession(session.id)}>
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
          <p className="text-muted-foreground">No sessions yet. Start your first session with the CLI!</p>
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
