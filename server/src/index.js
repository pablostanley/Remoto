import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import http from 'http';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

// Configuration
const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Allowed origins for WebSocket connections
const ALLOWED_ORIGINS = [
  'https://remoto.sh',
  'https://www.remoto.sh',
  'http://localhost:3000',  // Local dev
  'http://localhost:3001',
];

// Initialize Supabase client (service role for server-side operations)
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

// In-memory session store
// Map<sessionId, { cli: WebSocket, phones: Set<WebSocket>, token: string, userId: string, createdAt: Date }>
const sessions = new Map();

// Map<apiKey, userId> for quick lookups
const apiKeyCache = new Map();

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      sessions: sessions.size,
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Create WebSocket server with origin validation
const wss = new WebSocketServer({
  server,
  verifyClient: (info, callback) => {
    const origin = info.origin || info.req.headers.origin;

    // CLI connections don't have an origin (they're from Node.js)
    if (!origin) {
      callback(true);
      return;
    }

    // Check if origin is allowed
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(true);
    } else {
      console.log(`[Security] Rejected connection from origin: ${origin}`);
      callback(false, 403, 'Origin not allowed');
    }
  }
});

// Validate API key and get user ID
async function validateApiKey(apiKey) {
  // Check cache first
  if (apiKeyCache.has(apiKey)) {
    return apiKeyCache.get(apiKey);
  }

  if (!supabase) {
    // Dev mode - accept any key
    console.log('[DEV] Accepting API key without validation');
    return 'dev-user';
  }

  // Look up API key in database
  const { data, error } = await supabase
    .from('api_keys')
    .select('user_id, is_active')
    .eq('key_hash', hashApiKey(apiKey))
    .single();

  if (error || !data || !data.is_active) {
    return null;
  }

  // Cache the result
  apiKeyCache.set(apiKey, data.user_id);
  return data.user_id;
}

// Hash API key with SHA-256 (deterministic for lookups)
// This is the standard approach for API keys (used by Stripe, GitHub, etc.)
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Handle new WebSocket connections
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  console.log(`[WS] New connection: ${path}`);

  // Route based on path
  if (path.startsWith('/cli/')) {
    handleCliConnection(ws, url);
  } else if (path.startsWith('/phone/')) {
    handlePhoneConnection(ws, url);
  } else {
    ws.close(4000, 'Invalid path');
  }
});

// Handle CLI connections
async function handleCliConnection(ws, url) {
  const apiKey = url.searchParams.get('apiKey');
  let userId = null;
  let isAnonymous = true;

  // If API key provided, validate it
  if (apiKey) {
    userId = await validateApiKey(apiKey);
    if (!userId) {
      ws.close(4002, 'Invalid API key');
      return;
    }
    isAnonymous = false;
  }

  // Generate session credentials
  const sessionId = nanoid(12);
  const sessionToken = nanoid(32);

  // Store session
  sessions.set(sessionId, {
    cli: ws,
    phones: new Set(),
    token: sessionToken,
    userId,
    isAnonymous,
    createdAt: new Date(),
    buffer: [], // Buffer recent output for phone reconnection
  });

  // Send session info to CLI
  ws.send(JSON.stringify({
    type: 'session_created',
    sessionId,
    sessionToken,
    isAnonymous,
  }));

  console.log(`[CLI] Session created: ${sessionId} ${isAnonymous ? '(anonymous)' : `for user: ${userId}`}`);

  // Record session in database (only for authenticated users)
  if (supabase && userId) {
    await supabase.from('sessions').insert({
      id: sessionId,
      user_id: userId,
      status: 'active',
    });
  }

  // Handle messages from CLI
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleCliMessage(sessionId, message);
    } catch (err) {
      console.error('[CLI] Invalid message:', err);
    }
  });

  // Handle CLI disconnect
  ws.on('close', async () => {
    console.log(`[CLI] Disconnected: ${sessionId}`);
    const session = sessions.get(sessionId);
    if (session) {
      // Notify all connected phones
      for (const phone of session.phones) {
        phone.send(JSON.stringify({ type: 'cli_disconnected' }));
        phone.close(1000, 'CLI disconnected');
      }
      sessions.delete(sessionId);

      // Update database
      if (supabase) {
        await supabase
          .from('sessions')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', sessionId);
      }
    }
  });

  ws.on('error', (err) => {
    console.error(`[CLI] Error: ${sessionId}`, err);
  });
}

// Handle phone connections
function handlePhoneConnection(ws, url) {
  const sessionId = url.pathname.split('/')[2];
  const token = url.searchParams.get('token');

  if (!sessionId || !token) {
    ws.close(4001, 'Session ID and token required');
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    ws.close(4003, 'Session not found');
    return;
  }

  if (session.token !== token) {
    ws.close(4002, 'Invalid token');
    return;
  }

  // Add phone to session
  session.phones.add(ws);
  console.log(`[Phone] Connected to session: ${sessionId}`);

  // Send buffered output to phone
  if (session.buffer.length > 0) {
    ws.send(JSON.stringify({
      type: 'buffered_output',
      data: session.buffer.join(''),
    }));
  }

  // Notify CLI that phone connected
  if (session.cli.readyState === WebSocket.OPEN) {
    session.cli.send(JSON.stringify({
      type: 'phone_connected',
      phoneCount: session.phones.size,
    }));
  }

  // Handle messages from phone
  ws.on('message', (data) => {
    console.log(`[Phone] Raw message received:`, data.toString().substring(0, 100));
    try {
      const message = JSON.parse(data.toString());
      console.log(`[Phone] Parsed message type: ${message.type}`);
      handlePhoneMessage(sessionId, message);
    } catch (err) {
      console.error('[Phone] Invalid message:', err);
    }
  });

  // Handle phone disconnect
  ws.on('close', () => {
    console.log(`[Phone] Disconnected from session: ${sessionId}`);
    session.phones.delete(ws);

    // Notify CLI
    if (session.cli.readyState === WebSocket.OPEN) {
      session.cli.send(JSON.stringify({
        type: 'phone_disconnected',
        phoneCount: session.phones.size,
      }));
    }
  });

  ws.on('error', (err) => {
    console.error(`[Phone] Error: ${sessionId}`, err);
  });
}

// Handle messages from CLI
function handleCliMessage(sessionId, message) {
  const session = sessions.get(sessionId);
  if (!session) return;

  switch (message.type) {
    case 'output':
      // Buffer output (keep last 50KB)
      session.buffer.push(message.data);
      const totalSize = session.buffer.join('').length;
      while (totalSize > 50000 && session.buffer.length > 1) {
        session.buffer.shift();
      }

      // Forward to all phones
      for (const phone of session.phones) {
        if (phone.readyState === WebSocket.OPEN) {
          phone.send(JSON.stringify({ type: 'output', data: message.data }));
        }
      }
      break;

    case 'exit':
      // Notify phones and close session
      for (const phone of session.phones) {
        if (phone.readyState === WebSocket.OPEN) {
          phone.send(JSON.stringify({ type: 'exit', code: message.code }));
        }
      }
      break;

    default:
      console.log(`[CLI] Unknown message type: ${message.type}`);
  }
}

// Handle messages from phone
function handlePhoneMessage(sessionId, message) {
  const session = sessions.get(sessionId);
  if (!session) {
    console.log(`[Phone] No session found for: ${sessionId}`);
    return;
  }

  switch (message.type) {
    case 'input':
      // Forward input to CLI
      console.log(`[Phone] Forwarding input to CLI: "${message.data}"`);
      if (session.cli.readyState === WebSocket.OPEN) {
        session.cli.send(JSON.stringify({ type: 'input', data: message.data }));
        console.log(`[Phone] Input sent to CLI`);
      } else {
        console.log(`[Phone] CLI not open, state: ${session.cli.readyState}`);
      }
      break;

    case 'resize':
      // Forward resize to CLI
      if (session.cli.readyState === WebSocket.OPEN) {
        session.cli.send(JSON.stringify({
          type: 'resize',
          cols: message.cols,
          rows: message.rows
        }));
      }
      break;

    default:
      console.log(`[Phone] Unknown message type: ${message.type}`);
  }
}

// Cleanup stale sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    // Remove sessions older than 24 hours
    if (now - session.createdAt.getTime() > 24 * 60 * 60 * 1000) {
      console.log(`[Cleanup] Removing stale session: ${sessionId}`);
      if (session.cli.readyState === WebSocket.OPEN) {
        session.cli.close(1000, 'Session expired');
      }
      for (const phone of session.phones) {
        if (phone.readyState === WebSocket.OPEN) {
          phone.close(1000, 'Session expired');
        }
      }
      sessions.delete(sessionId);
    }
  }
}, 60000); // Check every minute

// Start server
server.listen(PORT, () => {
  console.log(`Remoto WebSocket server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  if (!supabase) {
    console.log('[DEV MODE] Running without Supabase - API key validation disabled');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});
