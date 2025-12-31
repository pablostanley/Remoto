export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get user's profile and stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single();

  // Get recent sessions
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user?.id)
    .order('started_at', { ascending: false })
    .limit(5);

  // Get current month usage
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: usage } = await supabase
    .from('usage')
    .select('*')
    .eq('user_id', user?.id)
    .gte('period_start', startOfMonth.toISOString().split('T')[0])
    .single();

  // Get API key count
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
        <p className="text-gray-400">
          Here&apos;s an overview of your Remoto usage
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="text-gray-400 text-sm mb-1">Sessions this month</div>
          <div className="text-3xl font-bold">{usage?.session_count || 0}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="text-gray-400 text-sm mb-1">Total time</div>
          <div className="text-3xl font-bold">
            {formatDuration(usage?.total_duration_seconds || 0)}
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="text-gray-400 text-sm mb-1">Active API keys</div>
          <div className="text-3xl font-bold">{apiKeyCount || 0}</div>
        </div>
      </div>

      {/* Quick start */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 mb-8">
        <h2 className="text-lg font-semibold mb-4">Quick Start</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium shrink-0">
              1
            </div>
            <div>
              <div className="font-medium mb-1">Create an API key</div>
              <p className="text-gray-400 text-sm mb-2">
                You need an API key to authenticate the CLI
              </p>
              <Link
                href="/dashboard/api-keys"
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Go to API Keys →
              </Link>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium shrink-0">
              2
            </div>
            <div>
              <div className="font-medium mb-1">Install the CLI</div>
              <code className="bg-gray-800 px-3 py-1 rounded text-sm text-green-400">
                npm install -g @remoto/cli
              </code>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium shrink-0">
              3
            </div>
            <div>
              <div className="font-medium mb-1">Start a session</div>
              <code className="bg-gray-800 px-3 py-1 rounded text-sm text-green-400">
                remoto
              </code>
              <p className="text-gray-400 text-sm mt-2">
                Scan the QR code with your phone to connect
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Sessions</h2>
          <Link
            href="/dashboard/sessions"
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            View all →
          </Link>
        </div>
        {recentSessions && recentSessions.length > 0 ? (
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-sm font-medium text-gray-400 px-4 py-3">
                    Session ID
                  </th>
                  <th className="text-left text-sm font-medium text-gray-400 px-4 py-3">
                    Started
                  </th>
                  <th className="text-left text-sm font-medium text-gray-400 px-4 py-3">
                    Duration
                  </th>
                  <th className="text-left text-sm font-medium text-gray-400 px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((session) => (
                  <tr
                    key={session.id}
                    className="border-b border-gray-800 last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-sm">{session.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(session.started_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {session.duration_seconds
                        ? formatDuration(session.duration_seconds)
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          session.status === 'active'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-gray-500/10 text-gray-400'
                        }`}
                      >
                        {session.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 text-center">
            <p className="text-gray-400">No sessions yet. Start your first session!</p>
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
