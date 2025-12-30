'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getPusherClient, disconnectPusher } from '@/lib/pusher';
import type { Channel } from 'pusher-js';

// Dynamic import to avoid SSR issues with xterm
const Terminal = dynamic(() => import('@/components/Terminal'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-500">Loading terminal...</div>
    </div>
  ),
});

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const token = searchParams.get('token');

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const channelRef = useRef<Channel | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Send command to terminal via HTTP API
  const sendCommand = useCallback(
    async (data: string) => {
      if (!token || !sessionId) return;
      try {
        await fetch(`/api/session/${sessionId}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: data, token }),
        });
      } catch (err) {
        console.error('Failed to send command:', err);
      }
    },
    [sessionId, token]
  );

  // Send resize event via HTTP API
  const sendResize = useCallback(
    async (cols: number, rows: number) => {
      if (!token || !sessionId) return;
      try {
        await fetch(`/api/session/${sessionId}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: '', token, type: 'resize', cols, rows }),
        });
      } catch (err) {
        console.error('Failed to send resize:', err);
      }
    },
    [sessionId, token]
  );

  useEffect(() => {
    if (!sessionId || !token) {
      setStatus('error');
      setErrorMessage('Invalid session URL. Please scan the QR code again.');
      return;
    }

    const pusher = getPusherClient();
    // Use public channel (no auth required)
    const channelName = `session-${sessionId}`;
    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;

    channel.bind('pusher:subscription_succeeded', async () => {
      setStatus('connected');

      // Notify CLI that phone connected
      try {
        await fetch(`/api/session/${sessionId}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, type: 'phone-connected' }),
        });
      } catch (err) {
        // Ignore errors
      }

      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    });

    channel.bind('pusher:subscription_error', (err: any) => {
      console.error('Subscription error:', err);
      setStatus('error');
      setErrorMessage('Failed to connect. The session may have expired.');
    });

    // Handle terminal output from CLI
    channel.bind('output', (data: { output: string }) => {
      const terminalEl = terminalRef.current;
      if (terminalEl && (terminalEl as any).terminalWrite) {
        (terminalEl as any).terminalWrite(data.output);
      }
    });

    // Handle session end
    channel.bind('exit', (data: { output: string }) => {
      setStatus('disconnected');
      // Send notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Remoto', {
          body: `Session ended (exit code: ${data.output})`,
          icon: '/icon-192.png',
        });
      }
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      disconnectPusher();
    };
  }, [sessionId, token]);

  if (status === 'error') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <div className="text-red-500 text-xl mb-4">Connection Error</div>
        <p className="text-gray-400 mb-8">{errorMessage}</p>
        <a
          href="/"
          className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-lg transition-colors"
        >
          Go Home
        </a>
      </main>
    );
  }

  if (status === 'disconnected') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <div className="text-yellow-500 text-xl mb-4">Session Ended</div>
        <p className="text-gray-400 mb-8">
          The terminal session has been closed.
        </p>
        <a
          href="/"
          className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-lg transition-colors"
        >
          Go Home
        </a>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-screen bg-[#0a0a0a]">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status === 'connected'
                ? 'bg-green-500'
                : status === 'connecting'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-400">
            {status === 'connected'
              ? 'Connected'
              : status === 'connecting'
              ? 'Connecting...'
              : 'Disconnected'}
          </span>
        </div>
        <span className="text-xs text-gray-600 font-mono">{sessionId}</span>
      </div>

      {/* Terminal */}
      <div ref={terminalRef} className="flex-1 overflow-hidden">
        {status === 'connecting' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Connecting to terminal...</div>
          </div>
        ) : (
          <Terminal onData={sendCommand} onResize={sendResize} />
        )}
      </div>
    </main>
  );
}
