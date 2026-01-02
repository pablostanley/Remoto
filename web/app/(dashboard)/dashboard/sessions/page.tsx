export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';

export default async function SessionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user?.id)
    .order('started_at', { ascending: false })
    .limit(100);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Sessions</h1>
        <p className="text-muted-foreground">View your session history</p>
      </div>

      {sessions && sessions.length > 0 ? (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Session ID</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Started</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Ended</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Duration</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-sm">{session.id}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(session.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {session.ended_at ? new Date(session.ended_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {session.duration_seconds ? formatDuration(session.duration_seconds) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      session.status === 'active' ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {session.status}
                    </span>
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
