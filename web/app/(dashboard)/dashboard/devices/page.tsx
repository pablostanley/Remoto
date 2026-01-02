'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Terminal } from '@phosphor-icons/react';

interface CliToken {
  id: string;
  token: string;
  last_used_at: string | null;
  created_at: string;
}

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  action: () => void;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<CliToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    description: '',
    action: () => {},
  });
  const supabase = createClient();

  const showConfirm = (title: string, description: string, action: () => void) => {
    setConfirmDialog({ open: true, title, description, action });
  };

  const handleConfirm = () => {
    confirmDialog.action();
    setConfirmDialog(prev => ({ ...prev, open: false }));
  };

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
    await supabase.from('cli_tokens').delete().eq('id', id);
    loadDevices();
  };

  const revokeAllDevices = async () => {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Devices</h1>
          <p className="text-muted-foreground">
            Manage terminals where you&apos;re logged in
          </p>
        </div>
        {devices.length > 1 && (
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => showConfirm(
              'Log out all devices?',
              'All terminals will be disconnected. You\'ll need to run `npx remotosh` again to reconnect.',
              revokeAllDevices
            )}
          >
            Log out all devices
          </Button>
        )}
      </div>

      {devices.length > 0 ? (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card rounded-lg border border-border overflow-hidden">
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
                          <Terminal size={16} className="text-muted-foreground" />
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => showConfirm(
                          'Log out this device?',
                          'The terminal will be disconnected. You\'ll need to run `npx remotosh` again to reconnect.',
                          () => revokeDevice(device.id)
                        )}
                      >
                        Log out
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {devices.map((device) => (
              <div key={device.id} className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <Terminal size={20} className="text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">Terminal</div>
                      <div className="text-xs text-muted-foreground font-mono">{getDevicePreview(device.token)}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground">
                    <span>Added {new Date(device.created_at).toLocaleDateString()}</span>
                    <span className="mx-2">·</span>
                    <span>{device.last_used_at ? getRelativeTime(device.last_used_at) : 'Never used'}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => showConfirm(
                      'Log out this device?',
                      'The terminal will be disconnected. You\'ll need to run `npx remotosh` again to reconnect.',
                      () => revokeDevice(device.id)
                    )}
                  >
                    Log out
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <p className="text-muted-foreground mb-2">No devices logged in yet</p>
          <p className="text-sm text-muted-foreground">
            Run <code className="bg-muted px-2 py-0.5 rounded">npx remotosh</code> in your terminal to get started
          </p>
        </div>
      )}

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
