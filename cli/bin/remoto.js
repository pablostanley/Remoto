#!/usr/bin/env node

import os from 'os';
import pty from 'node-pty';
import qrcode from 'qrcode-terminal';
import Pusher from 'pusher-js';
import { nanoid } from 'nanoid';
import chalk from 'chalk';

// Configuration
const WEB_APP_URL = process.env.REMOTO_WEB_URL || 'http://localhost:3000';
const PUSHER_KEY = process.env.PUSHER_KEY || 'your-pusher-key';
const PUSHER_CLUSTER = process.env.PUSHER_CLUSTER || 'us2';

// Generate session credentials
const sessionId = nanoid(12);
const sessionToken = nanoid(24);

// Detect shell
const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'zsh');

// Terminal dimensions
let cols = process.stdout.columns || 80;
let rows = process.stdout.rows || 24;

console.clear();
console.log(chalk.bold.cyan('\n  Remoto - Control your terminal from your phone\n'));
console.log(chalk.dim('  Scan this QR code with your phone to connect:\n'));

// Generate connection URL
const connectionUrl = `${WEB_APP_URL}/session/${sessionId}?token=${sessionToken}`;

// Display QR code
qrcode.generate(connectionUrl, { small: true }, (qr) => {
  console.log(qr);
  console.log(chalk.dim(`\n  Or open: ${chalk.underline(connectionUrl)}\n`));
  console.log(chalk.dim(`  Session ID: ${sessionId}`));
  console.log(chalk.dim(`  Waiting for connection...\n`));
  console.log(chalk.dim('─'.repeat(cols)));
});

// Initialize PTY
const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-256color',
  cols,
  rows,
  cwd: process.cwd(),
  env: process.env,
});

// Buffer for output
let outputBuffer = '';
let flushTimeout = null;
let isConnected = false;

// Send output to phone via HTTP API
async function sendOutput(output, type = 'output') {
  try {
    await fetch(`${WEB_APP_URL}/api/session/${sessionId}/output`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ output, token: sessionToken, type }),
    });
  } catch (err) {
    // Silently fail - network issues shouldn't break local terminal
  }
}

// Initialize Pusher client (for receiving commands from phone)
const pusher = new Pusher(PUSHER_KEY, {
  cluster: PUSHER_CLUSTER,
  forceTLS: true,
});

// Subscribe to session channel (public channel for simplicity)
const channel = pusher.subscribe(`session-${sessionId}`);

channel.bind('pusher:subscription_succeeded', () => {
  isConnected = true;
  console.log(chalk.green('  Ready for connection!\n'));
});

channel.bind('pusher:subscription_error', (err) => {
  console.log(chalk.yellow('  Running in offline mode (Pusher not configured)\n'));
  console.log(chalk.dim('  Set PUSHER_KEY and PUSHER_CLUSTER for remote access.\n'));
});

// Handle incoming commands from phone
channel.bind('command', (data) => {
  if (data.token === sessionToken) {
    ptyProcess.write(data.command);
  }
});

// Handle resize events from phone
channel.bind('resize', (data) => {
  if (data.token === sessionToken && data.cols && data.rows) {
    cols = data.cols;
    rows = data.rows;
    ptyProcess.resize(cols, rows);
  }
});

// Handle phone connection
channel.bind('phone-connected', (data) => {
  if (data.token === sessionToken) {
    console.log(chalk.green('\n  Phone connected!\n'));
  }
});

// Handle PTY output - batch and send to API
ptyProcess.onData((data) => {
  // Also write to local terminal
  process.stdout.write(data);

  // Buffer output for sending
  outputBuffer += data;

  // Debounce sending to avoid flooding
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(async () => {
    if (outputBuffer) {
      // Chunk large outputs
      const chunks = chunkString(outputBuffer, 8000);
      for (const chunk of chunks) {
        await sendOutput(chunk);
      }
      outputBuffer = '';
    }
  }, 50);
});

// Handle PTY exit
ptyProcess.onExit(async ({ exitCode }) => {
  console.log(chalk.dim(`\n  Session ended (exit code: ${exitCode})`));
  await sendOutput(String(exitCode), 'exit');
  pusher.disconnect();
  process.exit(exitCode);
});

// Handle terminal resize
process.stdout.on('resize', () => {
  const newCols = process.stdout.columns;
  const newRows = process.stdout.rows;
  ptyProcess.resize(newCols, newRows);
});

// Handle local input (allow both local and remote control)
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', (data) => {
  ptyProcess.write(data.toString());
});

// Cleanup on exit
process.on('SIGINT', () => {
  ptyProcess.kill();
  pusher.disconnect();
  process.exit();
});

// Helper to chunk strings
function chunkString(str, size) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks.length ? chunks : [''];
}
