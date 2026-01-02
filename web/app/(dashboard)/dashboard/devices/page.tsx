'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';

interface CliToken {
  id: string;
  token: string;
  last_used_at: string | null;
  created_at: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<CliToken[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    const { data } = await supabase
      .from('cli_tokens')
      .select('*')
      .order('created_at', { ascending: false });

    setDevices(data || []);
    setLoading(false);
  };

  const revokeDevice = async (id: string) => {
    if (!confirm('Are you sure you want to log out this device? You\'ll need to run `npx remotosh` again to reconnect.')) return;

    await supabase.from('cli_tokens').delete().eq('id', id);
    loadDevices();
  };

  const revokeAllDevices = async () => {
    if (!confirm('Are you sure you want to log out all devices?')) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('cli_tokens').delete().eq('user_id', user.id);
    loadDevices();
  };

  const getDevicePreview = (token: string) => {
    return token.substring(0, 12) + '...';
  };

  const getRelativeTime = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
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
          <h1 className="text-2xl font-bold mb-2">Devices</h1>
          <p className="text-muted-foreground">
            Manage terminals where you&apos;re logged in
          </p>
        </div>
        {devices.length > 1 && (
          <Button variant="outline" onClick={revokeAllDevices}>
            Log out all devices
          </Button>
        )}
      </div>

      {devices.length > 0 ? (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Device</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">First login</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Last used</th>
                <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium">Terminal</div>
                        <div className="text-sm text-muted-foreground font-mono">{getDevicePreview(device.token)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(device.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {device.last_used_at ? getRelativeTime(device.last_used_at) : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => revokeDevice(device.id)}>
                      Log out
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <p className="text-muted-foreground mb-2">No devices logged in yet</p>
          <p className="text-sm text-muted-foreground">
            Run <code className="bg-muted px-2 py-0.5 rounded">npx remotosh</code> in your terminal to get started
          </p>
        </div>
      )}
    </div>
  );
}
