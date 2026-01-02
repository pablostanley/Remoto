export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single();

  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user?.id)
    .order('started_at', { ascending: false })
    .limit(5);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: usage } = await supabase
    .from('usage')
    .select('*')
    .eq('user_id', user?.id)
    .gte('period_start', startOfMonth.toISOString().split('T')[0])
    .single();

  const { count: apiKeyCount } = await supabase
    .from('api_keys')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user?.id)
    .eq('is_active', true);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your Remoto usage
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-lg p-6 border border-border">
          <div className="text-muted-foreground text-sm mb-1">Sessions this month</div>
          <div className="text-3xl font-bold">{usage?.session_count || 0}</div>
        </div>
        <div className="bg-card rounded-lg p-6 border border-border">
          <div className="text-muted-foreground text-sm mb-1">Total time</div>
          <div className="text-3xl font-bold">
            {formatDuration(usage?.total_duration_seconds || 0)}
          </div>
        </div>
        <div className="bg-card rounded-lg p-6 border border-border">
          <div className="text-muted-foreground text-sm mb-1">Active API keys</div>
          <div className="text-3xl font-bold">{apiKeyCount || 0}</div>
        </div>
      </div>

      <div className="bg-card rounded-lg p-6 border border-border mb-8">
        <h2 className="text-lg font-semibold mb-4">Quick Start</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="bg-muted text-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium shrink-0">
              1
            </div>
            <div>
              <div className="font-medium mb-1">Create an API key</div>
              <p className="text-muted-foreground text-sm mb-2">
                You need an API key to authenticate the CLI
              </p>
              <Link
                href="/dashboard/api-keys"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                Go to API Keys →
              </Link>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="bg-muted text-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium shrink-0">
              2
            </div>
            <div>
              <div className="font-medium mb-1">Set your API key</div>
              <code className="bg-muted px-3 py-1 rounded text-sm">
                export REMOTO_API_KEY=&quot;your-key&quot;
              </code>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="bg-muted text-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium shrink-0">
              3
            </div>
            <div>
              <div className="font-medium mb-1">Start a session</div>
              <code className="bg-muted px-3 py-1 rounded text-sm">
                npx remotosh
              </code>
              <p className="text-muted-foreground text-sm mt-2">
                Scan the QR code with your phone to connect
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Sessions</h2>
          <Link
            href="/dashboard/sessions"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            View all →
          </Link>
        </div>
        {recentSessions && recentSessions.length > 0 ? (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Session ID</th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Started</th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Duration</th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((session) => (
                  <tr key={session.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-sm">{session.id}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(session.started_at).toLocaleString()}
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
            <p className="text-muted-foreground">No sessions yet. Start your first session!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
