#!/usr/bin/env node

import os from 'os';
import pty from 'node-pty';
import qrcode from 'qrcode-terminal';
import WebSocket from 'ws';
import chalk from 'chalk';

// Configuration
const WS_SERVER_URL = process.env.REMOTO_WS_URL || 'wss://remoto-ws.fly.dev';
const WEB_APP_URL = process.env.REMOTO_WEB_URL || 'https://remoto.sh';
const API_KEY = process.env.REMOTO_API_KEY;

// Sensitive environment variable patterns to filter out
const SENSITIVE_ENV_PATTERNS = [
  /^AWS_/i,
  /^AZURE_/i,
  /^GCP_/i,
  /^GOOGLE_/i,
  /^GITHUB_TOKEN$/i,
  /^GH_TOKEN$/i,
  /^GITLAB_/i,
  /^NPM_TOKEN$/i,
  /^NUGET_/i,
  /^DOCKER_/i,
  /^KUBERNETES_/i,
  /^K8S_/i,
  /SECRET/i,
  /PASSWORD/i,
  /PRIVATE_KEY/i,
  /API_KEY/i,
  /AUTH_TOKEN/i,
  /ACCESS_TOKEN/i,
  /REFRESH_TOKEN/i,
  /DATABASE_URL/i,
  /DB_PASSWORD/i,
  /POSTGRES_/i,
  /MYSQL_/i,
  /MONGO_/i,
  /REDIS_/i,
  /STRIPE_/i,
  /TWILIO_/i,
  /SENDGRID_/i,
  /MAILGUN_/i,
  /SUPABASE_/i,
  /FIREBASE_/i,
  /OPENAI_/i,
  /ANTHROPIC_/i,
  /SLACK_/i,
  /DISCORD_/i,
  /^REMOTO_API_KEY$/i,  // Our own API key
];

// Create sanitized environment for PTY
function getSanitizedEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (SENSITIVE_ENV_PATTERNS.some(pattern => pattern.test(key))) {
      delete env[key];
    }
  }
  return env;
}

// Detect shell
const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'zsh');

// Terminal dimensions
let cols = process.stdout.columns || 80;
let rows = process.stdout.rows || 24;

console.clear();
console.log(chalk.bold.white('\n  remoto'));
console.log(chalk.dim('  control your terminal from your phone\n'));
console.log(chalk.dim('  connecting...'));

// Connect to WebSocket server (API key is optional)
const wsUrl = API_KEY
  ? `${WS_SERVER_URL}/cli/?apiKey=${encodeURIComponent(API_KEY)}`
  : `${WS_SERVER_URL}/cli/`;
const ws = new WebSocket(wsUrl);

let ptyProcess = null;
let sessionId = null;
let sessionToken = null;
let isAnonymous = true;
let outputBuffer = '';
let flushTimeout = null;

ws.on('open', () => {
  // Connection established, wait for session_created message
});

ws.on('message', (data) => {
  const raw = data.toString();
  console.log(chalk.dim(`  [debug] received: ${raw.substring(0, 100)}`));
  try {
    const message = JSON.parse(raw);
    handleServerMessage(message);
  } catch (err) {
    console.error(chalk.red(`  invalid message from server: ${err.message}`));
    console.error(chalk.red(`  raw data: ${raw.substring(0, 50)}`));
  }
});

ws.on('close', (code, reason) => {
  console.log(chalk.dim(`\n  disconnected (${code})`));
  cleanup();
});

ws.on('error', (err) => {
  console.error(chalk.red(`\n  connection error: ${err.message}`));
  if (err.message.includes('ECONNREFUSED')) {
    console.log(chalk.dim('\n  make sure you have internet access'));
  }
  process.exit(1);
});

function handleServerMessage(message) {
  switch (message.type) {
    case 'session_created':
      sessionId = message.sessionId;
      sessionToken = message.sessionToken;
      isAnonymous = message.isAnonymous;
      showQRCode();
      startPTY();
      break;

    case 'phone_connected':
      console.log(chalk.green(`\n  phone connected`));
      if (message.phoneCount > 1) {
        console.log(chalk.dim(`  ${message.phoneCount} devices connected`));
      }
      console.log('');
      break;

    case 'phone_disconnected':
      if (message.phoneCount > 0) {
        console.log(chalk.yellow(`\n  phone disconnected (${message.phoneCount} remaining)\n`));
      } else {
        console.log(chalk.yellow(`\n  phone disconnected\n`));
      }
      break;

    case 'input':
      // Input from phone
      console.log(chalk.dim(`  [debug] input handler, ptyProcess exists: ${!!ptyProcess}`));
      if (ptyProcess) {
        console.log(chalk.dim(`  [debug] writing to pty: "${message.data}"`));
        ptyProcess.write(message.data);
      } else {
        console.log(chalk.red('  [debug] ptyProcess is null!'));
      }
      break;

    case 'resize':
      // Resize from phone
      if (ptyProcess && message.cols && message.rows) {
        ptyProcess.resize(message.cols, message.rows);
      }
      break;

    default:
      // Ignore unknown messages
  }
}

function showQRCode() {
  const connectionUrl = `${WEB_APP_URL}/session/${sessionId}?token=${sessionToken}`;

  console.clear();
  console.log(chalk.bold.white('\n  remoto'));
  console.log(chalk.dim('  control your terminal from your phone\n'));

  qrcode.generate(connectionUrl, { small: true }, (qr) => {
    // Indent the QR code
    const indentedQr = qr.split('\n').map(line => '  ' + line).join('\n');
    console.log(indentedQr);
    console.log(chalk.dim(`\n  ${connectionUrl}\n`));
    console.log(chalk.dim('  scan the qr code or open the link on your phone'));
    console.log(chalk.dim('  waiting for connection...\n'));
    console.log(chalk.dim('─'.repeat(Math.min(cols, 60))));
  });
}

function startPTY() {
  // Initialize PTY with sanitized environment (removes secrets)
  console.log(chalk.dim(`  [debug] spawning shell: ${shell}`));
  try {
    const sanitizedEnv = getSanitizedEnv();
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.cwd(),
      env: sanitizedEnv,
    });
    console.log(chalk.dim(`  [debug] pty spawned successfully, pid: ${ptyProcess.pid}`));
  } catch (err) {
    console.error(chalk.red(`  [debug] pty spawn failed: ${err.message}`));
    return;
  }

  // Handle PTY output
  ptyProcess.onData((data) => {
    // Write to local terminal
    process.stdout.write(data);

    // Buffer and send to server
    outputBuffer += data;

    if (flushTimeout) clearTimeout(flushTimeout);
    flushTimeout = setTimeout(() => {
      if (outputBuffer && ws.readyState === WebSocket.OPEN) {
        // Chunk large outputs
        const chunks = chunkString(outputBuffer, 16000);
        for (const chunk of chunks) {
          ws.send(JSON.stringify({ type: 'output', data: chunk }));
        }
        outputBuffer = '';
      }
    }, 30);
  });

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode }) => {
    console.log(chalk.dim(`\n  session ended`));

    // Show account nudge for anonymous users
    if (isAnonymous) {
      console.log(chalk.dim('\n  ─────────────────────────────────────────'));
      console.log(chalk.white('\n  create an account to save session history'));
      console.log(chalk.dim(`  ${WEB_APP_URL}/signup\n`));
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
      ws.close();
    }
    process.exit(exitCode);
  });

  // Handle local terminal resize
  process.stdout.on('resize', () => {
    cols = process.stdout.columns;
    rows = process.stdout.rows;
    if (ptyProcess) {
      ptyProcess.resize(cols, rows);
    }
  });

  // Handle local input
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (data) => {
    if (ptyProcess) {
      ptyProcess.write(data.toString());
    }
  });
}

function cleanup() {
  if (ptyProcess) {
    ptyProcess.kill();
  }
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  process.exit();
}

// Cleanup on exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Helper to chunk strings
function chunkString(str, size) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks.length ? chunks : [''];
}
