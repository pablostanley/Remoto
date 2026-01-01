'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import nextDynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with xterm
const Terminal = nextDynamic(() => import('@/components/Terminal'), {
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
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const writeToTerminalRef = useRef<((data: string) => void) | null>(null);

  // Send command to terminal
  const sendCommand = useCallback(
    (data: string) => {
      console.log('[Session] sendCommand called with:', data);
      console.log('[Session] WebSocket state:', wsRef.current?.readyState, 'OPEN is:', WebSocket.OPEN);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('[Session] Sending to WebSocket:', { type: 'input', data });
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      } else {
        console.log('[Session] WebSocket not open, cannot send');
      }
    },
    []
  );

  // Send resize event
  const sendResize = useCallback(
    (cols: number, rows: number) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    },
    []
  );

  useEffect(() => {
    if (!sessionId || !token) {
      setStatus('error');
      setErrorMessage('Invalid session URL. Please scan the QR code again.');
      return;
    }

    const connect = () => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://remoto-ws.fly.dev';
      const ws = new WebSocket(`${wsUrl}/phone/${sessionId}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      };

      ws.onmessage = (event) => {
        console.log('[Session] Received message:', event.data);
        try {
          const message = JSON.parse(event.data);
          console.log('[Session] Parsed message:', message);
          handleMessage(message);
        } catch (err) {
          console.error('Invalid message:', err);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);

        if (event.code === 4003) {
          setStatus('error');
          setErrorMessage('Session not found. It may have expired.');
        } else if (event.code === 4002) {
          setStatus('error');
          setErrorMessage('Invalid session token.');
        } else if (event.code === 1000) {
          setStatus('disconnected');
        } else {
          // Try to reconnect
          setStatus('connecting');
          reconnectTimeoutRef.current = setTimeout(connect, 2000);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [sessionId, token]);

  const handleMessage = (message: { type: string; data?: string; code?: number }) => {
    switch (message.type) {
      case 'output':
        // Write terminal output
        if (writeToTerminalRef.current && message.data) {
          writeToTerminalRef.current(message.data);
        }
        break;

      case 'buffered_output':
        // Write buffered output (on reconnect)
        if (writeToTerminalRef.current && message.data) {
          writeToTerminalRef.current(message.data);
        }
        break;

      case 'exit':
        setStatus('disconnected');
        // Send notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Remoto', {
            body: `Session ended (exit code: ${message.code})`,
            icon: '/icon-192.png',
          });
        }
        break;

      case 'cli_disconnected':
        setStatus('disconnected');
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Remoto', {
            body: 'Terminal disconnected',
            icon: '/icon-192.png',
          });
        }
        break;
    }
  };

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
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 safe-area-inset">
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
      <div className="flex-1 overflow-hidden">
        {status === 'connecting' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Connecting to terminal...</div>
          </div>
        ) : (
          <Terminal
            onData={sendCommand}
            onResize={sendResize}
            onReady={(write) => { writeToTerminalRef.current = write; }}
          />
        )}
      </div>
    </main>
  );
}
