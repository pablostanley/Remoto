'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { DotsThreeVertical, XSquare, Link, ArrowClockwise, Power } from '@phosphor-icons/react';

// Dynamic import to avoid SSR issues with xterm
const Terminal = nextDynamic(() => import('@/components/Terminal'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-muted-foreground">Loading terminal...</div>
    </div>
  ),
});

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Taco logo SVG component
function TacoLogo({ className }: { className?: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="32" height="32" rx="8" fill="#FFE100"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M13.7905 4.03609C14.5012 3.91814 15.2535 4.09242 15.8485 4.51293L16.0696 4.66911L16.167 4.56725C16.2984 4.42957 16.7975 4.18994 17.1304 4.10464C17.4788 4.01535 18.2997 4.01426 18.6372 4.10258C19.2012 4.25025 19.7711 4.62144 19.9942 4.98645C20.0515 5.08013 20.1031 5.16334 20.1091 5.17148C20.1149 5.17954 20.2601 5.1435 20.4317 5.09135C21.4703 4.77579 22.704 5.26787 23.1773 6.1865C23.2443 6.31662 23.3114 6.52458 23.3263 6.64853L23.3535 6.87389H23.663C24.286 6.87389 24.8125 7.08877 25.2577 7.5248C25.6825 7.94073 25.8901 8.45936 25.8452 8.99215L25.824 9.24371L26.0691 9.26857C27.0806 9.37127 28.0563 10.6094 27.8706 11.5545C27.8445 11.6873 27.8147 11.8263 27.8044 11.8632C27.7902 11.9143 27.8498 11.9375 28.0539 11.9602C28.5797 12.0188 29.2113 12.4387 29.4982 12.9203C29.7846 13.4011 29.8024 14.0653 29.5414 14.5393L29.4043 14.7883L29.5228 14.8176C29.9143 14.9142 30.4795 15.4323 30.7217 15.9164C31.1356 16.7438 31.084 17.6405 30.5922 18.1653L30.4091 18.3608L30.5287 18.6869C30.5945 18.8663 30.6483 19.1017 30.6483 19.2101C30.6483 19.9943 30.24 20.6697 29.5859 20.9676C29.3717 21.0652 29.2545 21.0876 28.9662 21.0861L28.6106 21.0843L28.5831 21.2819C28.5438 21.5642 28.3638 21.8818 28.1037 22.1279C27.4018 22.7922 26.171 22.9057 25.4598 22.3717C25.2161 22.1887 25.2029 22.1847 25.2008 22.2928C25.1977 22.4519 24.8935 23.1573 24.7125 23.4251C23.7067 24.9133 21.5001 25.8429 18.3154 26.1415V26.7335L18.3152 26.7628C18.2992 28.0011 17.2739 29 16.0113 29C14.7488 29 13.7234 28.0011 13.7074 26.7628L13.7072 26.7335V26.1453C10.6094 25.8505 8.36277 24.9219 7.39913 23.4961C7.19433 23.193 6.93413 22.62 6.87961 22.352C6.86407 22.2754 6.84224 22.2127 6.83111 22.2127C6.82004 22.2127 6.73192 22.2751 6.63534 22.3515C6.25854 22.6494 5.52595 22.7923 4.99597 22.6713C4.60498 22.5821 4.16613 22.3573 3.93149 22.1261C3.67326 21.8717 3.46503 21.4787 3.46503 21.2457V21.0751L3.08101 21.083C2.74785 21.0899 2.66004 21.0739 2.41772 20.9625C1.95441 20.7495 1.63969 20.3911 1.46179 19.8737C1.33006 19.4908 1.34978 18.964 1.50929 18.6042L1.61702 18.361L1.42615 18.1692C0.923133 17.6637 0.860649 16.8211 1.26415 15.9856C1.47757 15.5438 1.96596 15.0531 2.35868 14.8858C2.50537 14.8233 2.61951 14.762 2.61246 14.7493C2.37489 14.3309 2.32463 14.1632 2.32463 13.7878C2.32463 13.4444 2.3423 13.362 2.47464 13.0871C2.75559 12.5037 3.31618 12.0756 3.94972 11.9607C4.10096 11.9333 4.22939 11.9056 4.23527 11.8993C4.24095 11.8928 4.22381 11.7565 4.19718 11.5964C4.13634 11.2305 4.19885 10.8682 4.39337 10.4593C4.67046 9.87681 5.39175 9.33362 5.98368 9.26168L6.22855 9.23195L6.21664 8.94573C6.17117 7.85508 7.18081 6.8739 8.34856 6.87389H8.7128L8.74257 6.6564C8.79131 6.30022 8.97757 5.97157 9.30959 5.65605C9.82048 5.17048 10.3906 4.96721 11.122 5.00979C11.364 5.02385 11.6276 5.06908 11.7463 5.11684C11.9451 5.19687 11.9533 5.19677 12.0023 5.11483C12.3466 4.53873 12.948 4.17597 13.7905 4.03609ZM16.5 25.7491C16.5 26.0272 16.2708 26.2527 15.988 26.2527C15.7053 26.2527 15.476 26.0272 15.476 25.7491V24.6035L14.7939 25.0237C14.726 25.0655 14.6847 25.1389 14.6847 25.2177V26.7335C14.6847 27.4542 15.2787 28.0385 16.0113 28.0385C16.744 28.0385 17.3379 27.4542 17.3379 26.7335V25.2177C17.3379 25.1389 17.2966 25.0655 17.2287 25.0237L16.5301 24.5934C16.5202 24.5872 16.5102 24.5813 16.5 24.5755V25.7491ZM25.0188 11.7274C24.7804 11.7274 24.7651 11.8286 24.9737 12.0283C25.2284 12.272 25.3264 12.4384 25.4146 12.7769C25.5131 13.1556 25.4714 13.4499 25.2792 13.7304C25.0891 14.0079 24.9043 14.1086 24.5167 14.1464C24.2404 14.1733 24.2016 14.1885 24.2016 14.2707C24.2016 14.3293 24.313 14.458 24.4989 14.6141C25.0993 15.1184 25.2225 15.72 24.8335 16.2483C24.6643 16.478 24.2624 16.6809 23.9214 16.7087C23.5297 16.7407 23.2454 16.6225 22.9188 16.2922C22.7501 16.1215 22.6266 16.0297 22.6015 16.0564C22.5789 16.0805 22.5341 16.1825 22.5019 16.2832C22.2925 16.9392 21.8366 17.2677 21.1358 17.2676C20.5794 17.2676 20.0118 16.872 19.8216 16.3517L19.7393 16.1267L19.5349 16.3121C18.6398 17.1237 16.585 16.6647 16.062 15.5735C15.478 16.6268 13.4812 17.2281 12.5309 16.3181C12.4354 16.2267 12.3498 16.1608 12.3406 16.1717C12.3315 16.1827 12.2786 16.2859 12.2231 16.4011C12.0767 16.7054 11.842 16.9542 11.5581 17.1062C11.2079 17.2937 10.6679 17.3243 10.3185 17.1764C9.99214 17.0383 9.69389 16.716 9.56119 16.358C9.50337 16.202 9.43497 16.0615 9.40923 16.0459C9.38346 16.0303 9.26862 16.1245 9.15399 16.2554C8.8999 16.5456 8.65472 16.6749 8.29874 16.7067C7.55888 16.7727 6.97308 16.276 6.98621 15.5938C6.99464 15.1561 7.22031 14.7943 7.65677 14.5188C7.8342 14.4068 7.88834 14.3467 7.87778 14.2737C7.86553 14.1896 7.82425 14.1739 7.56113 14.1529C7.39473 14.1397 7.19574 14.0953 7.11894 14.0543C6.45134 13.6975 6.41629 12.6839 7.05035 12.0696C7.22596 11.8994 7.26731 11.8339 7.22826 11.7876C7.15439 11.7001 6.86235 11.7141 6.6972 11.8132C6.48178 11.9424 6.22253 12.2646 6.12446 12.525C5.86995 13.2009 5.99517 13.8621 6.47733 14.3877L6.6287 14.5527L6.45492 14.8865C6.29118 15.2009 6.2812 15.2443 6.28264 15.6372C6.28455 16.1532 6.40743 16.4502 6.76034 16.7919C7.22175 17.2387 7.778 17.4369 8.43216 17.3877C8.77938 17.3616 8.81887 17.3671 8.86271 17.4476C8.94277 17.5948 8.91948 17.7775 8.72398 18.5349C8.46816 19.526 8.38241 20.2018 8.41416 20.9764C8.45996 22.0921 8.72311 22.7668 9.35373 23.3858C10.0608 24.0797 10.9006 24.3754 12.1693 24.3773C12.9723 24.3785 13.3563 24.2954 14.0078 23.9792C14.5454 23.7183 14.9411 23.3453 15.1721 22.882C15.3662 22.4926 15.428 22.1973 15.4262 21.6684L15.4248 21.2741L15.1405 21.1139C14.4244 20.7103 13.7457 19.9328 13.9143 19.1018C14.1036 18.169 17.8626 17.8965 18.197 19.2306C18.2747 19.5403 18.1325 19.6668 17.969 19.9944C17.7604 20.4127 17.2333 20.9659 16.8588 21.1596L16.6377 21.2739L16.6386 21.6174C16.6404 22.4019 16.9078 23.0755 17.3954 23.5242C17.9218 24.0086 18.592 24.2766 19.5079 24.3688C20.3453 24.4532 21.1639 24.3141 21.8944 23.9634C22.7446 23.5551 23.3354 22.8111 23.5569 21.8693C23.6244 21.5825 23.6422 21.3292 23.6392 20.7017C23.6351 19.8142 23.5778 19.4138 23.3146 18.4324C23.2264 18.1035 23.1546 17.7635 23.155 17.6769C23.1563 17.4063 23.1919 17.387 23.6981 17.3829C23.9985 17.3805 24.2478 17.3508 24.4259 17.2964C24.9772 17.1278 25.5294 16.6368 25.6906 16.172C25.7702 15.9423 25.7831 15.4021 25.7147 15.1598C25.6896 15.0708 25.6045 14.8979 25.5256 14.7755L25.3821 14.5531L25.5668 14.365C25.6683 14.2616 25.8106 14.0637 25.8828 13.9252C26.0021 13.6966 26.0145 13.6288 26.0157 13.1926C26.0168 12.7575 26.0041 12.6845 25.8823 12.425C25.6833 12.0012 25.3445 11.7274 25.0188 11.7274Z" fill="black"/>
    </svg>
  );
}

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const token = searchParams.get('token');

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showMenu, setShowMenu] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const writeToTerminalRef = useRef<((data: string) => void) | null>(null);

  // Truncate session ID for display
  const displayName = sessionId.length > 12 ? sessionId.slice(0, 12) + '…' : sessionId;

  // Send command to terminal
  const sendCommand = useCallback(
    (data: string) => {
      // Don't log input data - may contain passwords/secrets
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
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
        // Don't log message content - may contain sensitive terminal output
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch {
          // Invalid message format
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

  // Session actions
  const handleClearTerminal = () => {
    // Send clear screen sequence
    sendCommand('\x0c');
    setShowMenu(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShowMenu(false);
    } catch {
      // Fallback - select and copy
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setShowMenu(false);
    }
  };

  const handleEndSession = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User ended session');
    }
    setShowMenu(false);
  };

  const handleReconnect = () => {
    setStatus('connecting');
    setShowMenu(false);
    // Clear existing timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }
    // Reconnect after a short delay
    setTimeout(() => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://remoto-ws.fly.dev';
      const ws = new WebSocket(`${wsUrl}/phone/${sessionId}?token=${encodeURIComponent(token || '')}`);
      wsRef.current = ws;

      ws.onopen = () => setStatus('connected');
      ws.onmessage = (event) => {
        try {
          handleMessage(JSON.parse(event.data));
        } catch {}
      };
      ws.onclose = (event) => {
        if (event.code === 4003 || event.code === 4002) {
          setStatus('error');
          setErrorMessage('Session not found or invalid token.');
        } else {
          setStatus('disconnected');
        }
      };
    }, 100);
  };

  if (status === 'error') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <div className="text-destructive text-xl mb-4">Connection Error</div>
        <p className="text-muted-foreground mb-8">{errorMessage}</p>
        <a
          href="/"
          className="bg-secondary hover:bg-secondary/80 px-6 py-3 rounded-lg transition-colors"
        >
          Go Home
        </a>
      </main>
    );
  }

  if (status === 'disconnected') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <div className="text-foreground text-xl mb-4">Session Ended</div>
        <p className="text-muted-foreground mb-8">
          The terminal session has been closed.
        </p>
        <a
          href="/"
          className="bg-secondary hover:bg-secondary/80 px-6 py-3 rounded-lg transition-colors"
        >
          Go Home
        </a>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-[100dvh] bg-[#0a0a0a] overflow-hidden">
      {/* Header bar */}
      <div className="shrink-0 flex items-center justify-between px-2 py-2 bg-background safe-area-top">
        {/* Logo button */}
        <button
          type="button"
          onClick={() => window.location.href = '/'}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary active:bg-secondary/80 transition-colors"
        >
          <TacoLogo className="w-6 h-6" />
        </button>

        {/* Terminal name + status */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-muted-foreground font-mono">{displayName}</span>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                status === 'connected'
                  ? 'bg-green-500'
                  : status === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-destructive'
              }`}
            />
            <span className="text-[10px] text-muted-foreground">
              {status === 'connected'
                ? 'connected'
                : status === 'connecting'
                ? 'connecting'
                : 'disconnected'}
            </span>
          </div>
        </div>

        {/* Menu button */}
        <button
          type="button"
          onClick={() => setShowMenu(true)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary active:bg-secondary/80 transition-colors"
        >
          <DotsThreeVertical size={20} weight="bold" className="text-muted-foreground" />
        </button>
      </div>

      {/* Terminal */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {status === 'connecting' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Connecting to terminal...</div>
          </div>
        ) : (
          <Terminal
            onData={sendCommand}
            onResize={sendResize}
            onReady={(write) => { writeToTerminalRef.current = write; }}
          />
        )}
      </div>

      {/* Session menu drawer */}
      <Drawer open={showMenu} onOpenChange={setShowMenu}>
        <DrawerContent className="bg-background border-border">
          <DrawerHeader className="border-b border-border">
            <DrawerTitle className="text-foreground text-center">Session Options</DrawerTitle>
          </DrawerHeader>

          <div className="p-4 space-y-2">
            {/* Clear terminal */}
            <button
              onClick={handleClearTerminal}
              className="w-full flex items-center gap-4 px-4 py-4 bg-card hover:bg-card/80 active:bg-card/60 border border-border rounded-xl text-left"
            >
              <XSquare size={20} className="text-muted-foreground" />
              <div>
                <div className="text-foreground text-sm font-medium">Clear Terminal</div>
                <div className="text-muted-foreground text-xs">Clear the screen</div>
              </div>
            </button>

            {/* Copy link */}
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-4 px-4 py-4 bg-card hover:bg-card/80 active:bg-card/60 border border-border rounded-xl text-left"
            >
              <Link size={20} className="text-muted-foreground" />
              <div>
                <div className="text-foreground text-sm font-medium">Copy Session Link</div>
                <div className="text-muted-foreground text-xs">Share this session URL</div>
              </div>
            </button>

            {/* Reconnect - only show when not connected */}
            {status !== 'connected' && (
              <button
                onClick={handleReconnect}
                className="w-full flex items-center gap-4 px-4 py-4 bg-card hover:bg-card/80 active:bg-card/60 border border-border rounded-xl text-left"
              >
                <ArrowClockwise size={20} className="text-muted-foreground" />
                <div>
                  <div className="text-foreground text-sm font-medium">Reconnect</div>
                  <div className="text-muted-foreground text-xs">Try to reconnect to the session</div>
                </div>
              </button>
            )}

            {/* Session info */}
            <div className="px-4 py-4 bg-card border border-border rounded-xl">
              <div className="text-muted-foreground text-xs mb-1">Session ID</div>
              <div className="text-foreground text-sm font-mono break-all">{sessionId}</div>
            </div>

            {/* End session - destructive */}
            <button
              onClick={handleEndSession}
              className="w-full flex items-center gap-4 px-4 py-4 bg-destructive/10 hover:bg-destructive/20 active:bg-destructive/30 border border-destructive/30 rounded-xl text-left mt-4"
            >
              <Power size={20} className="text-destructive" />
              <div>
                <div className="text-destructive text-sm font-medium">End Session</div>
                <div className="text-destructive/60 text-xs">Disconnect and close this session</div>
              </div>
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
