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

// Session limits
const MAX_CONCURRENT_SESSIONS = 2;
const MAX_SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour

// Security limits
const API_KEY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CONNECTIONS_PER_IP = 10;
const CONNECTION_WINDOW_MS = 60 * 1000; // 1 minute

// Initialize Supabase client (service role for server-side operations)
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

// In-memory session store
// Map<sessionId, { cli: WebSocket, phones: Set<WebSocket>, token: string, userId: string, createdAt: Date }>
const sessions = new Map();

// Map<apiKey, { userId, cachedAt }> for quick lookups with TTL
const apiKeyCache = new Map();

// Map<ip, { count, windowStart }> for rate limiting
const connectionRateLimit = new Map();

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

// Check rate limit for IP
function checkRateLimit(ip) {
  const now = Date.now();
  const record = connectionRateLimit.get(ip);

  if (!record) {
    connectionRateLimit.set(ip, { count: 1, windowStart: now });
    return true;
  }

  // Reset window if expired
  if (now - record.windowStart > CONNECTION_WINDOW_MS) {
    connectionRateLimit.set(ip, { count: 1, windowStart: now });
    return true;
  }

  // Check if over limit
  if (record.count >= MAX_CONNECTIONS_PER_IP) {
    return false;
  }

  // Increment count
  record.count++;
  return true;
}

// Validate CLI token and get user ID
async function validateCliToken(token) {
  // Check cache first (with TTL)
  if (apiKeyCache.has(token)) {
    const cached = apiKeyCache.get(token);
    const age = Date.now() - cached.cachedAt;

    if (age < API_KEY_CACHE_TTL_MS) {
      return cached.userId;
    }
    apiKeyCache.delete(token);
  }

  if (!supabase) {
    console.log('[DEV] Accepting token without validation');
    return 'dev-user';
  }

  // Look up CLI token in database
  const { data, error } = await supabase
    .from('cli_tokens')
    .select('user_id')
    .eq('token', token)
    .single();

  if (error || !data) {
    return null;
  }

  // Cache the result
  apiKeyCache.set(token, {
    userId: data.user_id,
    cachedAt: Date.now(),
  });

  // Update last used
  await supabase
    .from('cli_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', token);

  return data.user_id;
}

// Validate API key and get user ID (legacy support)
async function validateApiKey(apiKey) {
  // Check cache first (with TTL)
  if (apiKeyCache.has(apiKey)) {
    const cached = apiKeyCache.get(apiKey);
    const age = Date.now() - cached.cachedAt;

    // Return cached value if not expired
    if (age < API_KEY_CACHE_TTL_MS) {
      return cached.userId;
    }

    // Cache expired, remove it
    apiKeyCache.delete(apiKey);
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

  // Cache the result with timestamp
  apiKeyCache.set(apiKey, {
    userId: data.user_id,
    cachedAt: Date.now(),
  });

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

  // Get client IP (handle proxies)
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
             req.headers['x-real-ip'] ||
             req.socket.remoteAddress ||
             'unknown';

  // Check rate limit
  if (!checkRateLimit(ip)) {
    console.log(`[Security] Rate limit exceeded for IP: ${ip}`);
    ws.close(4029, 'Too many connections. Please wait and try again.');
    return;
  }

  console.log(`[WS] New connection: ${path} from ${ip}`);

  // Route based on path
  if (path.startsWith('/cli/')) {
    handleCliConnection(ws, url);
  } else if (path.startsWith('/phone/')) {
    handlePhoneConnection(ws, url);
  } else {
    ws.close(4000, 'Invalid path');
  }
});

// Count active sessions for a user
function countUserSessions(userId) {
  let count = 0;
  for (const session of sessions.values()) {
    if (session.userId === userId) {
      count++;
    }
  }
  return count;
}

// Handle CLI connections
async function handleCliConnection(ws, url) {
  const token = url.searchParams.get('token');
  const apiKey = url.searchParams.get('apiKey');

  // Need either token or API key
  if (!token && !apiKey) {
    ws.close(4001, 'Authentication required');
    return;
  }

  // Validate token or API key
  let userId;
  if (token && token.startsWith('cli_')) {
    userId = await validateCliToken(token);
  } else if (apiKey) {
    userId = await validateApiKey(apiKey);
  }

  if (!userId) {
    ws.close(4002, 'Invalid credentials');
    return;
  }

  // Check concurrent session limit
  const currentSessions = countUserSessions(userId);
  if (currentSessions >= MAX_CONCURRENT_SESSIONS) {
    ws.close(4004, `Session limit reached (max ${MAX_CONCURRENT_SESSIONS}). Close an existing session first.`);
    return;
  }

  // Generate session credentials
  const sessionId = nanoid(21); // Increased from 12 for better entropy
  const sessionToken = nanoid(32);

  // Store session
  sessions.set(sessionId, {
    cli: ws,
    phones: new Set(),
    token: sessionToken,
    userId,
    createdAt: new Date(),
    buffer: [], // Buffer recent output for phone reconnection
  });

  // Send session info to CLI
  ws.send(JSON.stringify({
    type: 'session_created',
    sessionId,
    sessionToken,
    maxDuration: MAX_SESSION_DURATION_MS,
  }));

  console.log(`[CLI] Session created: ${sessionId} for user: ${userId} (${currentSessions + 1}/${MAX_CONCURRENT_SESSIONS})`);

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
    try {
      const message = JSON.parse(data.toString());
      // Only log message type, not content (may contain sensitive data like passwords)
      console.log(`[Phone] Message type: ${message.type}, session: ${sessionId}`);
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
      // Forward input to CLI (don't log content - may contain passwords/secrets)
      if (session.cli.readyState === WebSocket.OPEN) {
        session.cli.send(JSON.stringify({ type: 'input', data: message.data }));
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

// Cleanup expired sessions and rate limit entries periodically
setInterval(() => {
  const now = Date.now();

  // Clean up stale rate limit entries
  for (const [ip, record] of connectionRateLimit.entries()) {
    if (now - record.windowStart > CONNECTION_WINDOW_MS * 2) {
      connectionRateLimit.delete(ip);
    }
  }

  // Clean up expired API key cache entries
  for (const [key, cached] of apiKeyCache.entries()) {
    if (now - cached.cachedAt > API_KEY_CACHE_TTL_MS) {
      apiKeyCache.delete(key);
    }
  }

  // Clean up expired sessions
  for (const [sessionId, session] of sessions.entries()) {
    const sessionAge = now - session.createdAt.getTime();
    const timeRemaining = MAX_SESSION_DURATION_MS - sessionAge;

    // Warn when 5 minutes remaining
    if (timeRemaining > 0 && timeRemaining <= 5 * 60 * 1000 && !session.warnedExpiring) {
      session.warnedExpiring = true;
      // Send warning to phones
      for (const phone of session.phones) {
        if (phone.readyState === WebSocket.OPEN) {
          phone.send(JSON.stringify({
            type: 'session_expiring',
            minutesRemaining: Math.ceil(timeRemaining / 60000),
          }));
        }
      }
      // Send warning to CLI
      if (session.cli.readyState === WebSocket.OPEN) {
        session.cli.send(JSON.stringify({
          type: 'session_expiring',
          minutesRemaining: Math.ceil(timeRemaining / 60000),
        }));
      }
    }

    // Remove expired sessions (1 hour limit)
    if (sessionAge > MAX_SESSION_DURATION_MS) {
      console.log(`[Cleanup] Session expired: ${sessionId} (user: ${session.userId})`);
      if (session.cli.readyState === WebSocket.OPEN) {
        session.cli.close(1000, 'Session expired (1 hour limit)');
      }
      for (const phone of session.phones) {
        if (phone.readyState === WebSocket.OPEN) {
          phone.close(1000, 'Session expired (1 hour limit)');
        }
      }
      sessions.delete(sessionId);
    }
  }
}, 30000); // Check every 30 seconds

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
