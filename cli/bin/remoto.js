#!/usr/bin/env node

import os from 'os';
import pty from 'node-pty';
import qrcode from 'qrcode-terminal';
import WebSocket from 'ws';
import chalk from 'chalk';

// Configuration
const WS_SERVER_URL = process.env.REMOTO_WS_URL || 'ws://localhost:8080';
const WEB_APP_URL = process.env.REMOTO_WEB_URL || 'http://localhost:3000';
const API_KEY = process.env.REMOTO_API_KEY;

// Check for API key
if (!API_KEY) {
  console.log(chalk.red('\n  Error: REMOTO_API_KEY environment variable is required\n'));
  console.log(chalk.dim('  Get your API key from: https://remoto.dev/dashboard/api-keys\n'));
  console.log(chalk.dim('  Then set it:'));
  console.log(chalk.cyan('    export REMOTO_API_KEY="your-api-key"\n'));
  process.exit(1);
}

// Detect shell
const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'zsh');

// Terminal dimensions
let cols = process.stdout.columns || 80;
let rows = process.stdout.rows || 24;

console.clear();
console.log(chalk.bold.cyan('\n  Remoto - Control your terminal from your phone\n'));
console.log(chalk.dim('  Connecting to server...\n'));

// Connect to WebSocket server
const wsUrl = `${WS_SERVER_URL}/cli/?apiKey=${encodeURIComponent(API_KEY)}`;
const ws = new WebSocket(wsUrl);

let ptyProcess = null;
let sessionId = null;
let sessionToken = null;
let outputBuffer = '';
let flushTimeout = null;

ws.on('open', () => {
  console.log(chalk.green('  Connected to server\n'));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    handleServerMessage(message);
  } catch (err) {
    console.error(chalk.red('  Invalid message from server'));
  }
});

ws.on('close', (code, reason) => {
  console.log(chalk.dim(`\n  Disconnected from server (${code})`));
  if (reason) {
    console.log(chalk.dim(`  Reason: ${reason}`));
  }
  cleanup();
});

ws.on('error', (err) => {
  console.error(chalk.red(`\n  Connection error: ${err.message}`));
  if (err.message.includes('ECONNREFUSED')) {
    console.log(chalk.dim('\n  Make sure the Remoto server is running.'));
  }
  process.exit(1);
});

function handleServerMessage(message) {
  switch (message.type) {
    case 'session_created':
      sessionId = message.sessionId;
      sessionToken = message.sessionToken;
      showQRCode();
      startPTY();
      break;

    case 'phone_connected':
      console.log(chalk.green(`\n  Phone connected! (${message.phoneCount} device${message.phoneCount > 1 ? 's' : ''})\n`));
      break;

    case 'phone_disconnected':
      console.log(chalk.yellow(`\n  Phone disconnected (${message.phoneCount} device${message.phoneCount > 1 ? 's' : ''} remaining)\n`));
      break;

    case 'input':
      // Input from phone
      if (ptyProcess) {
        ptyProcess.write(message.data);
      }
      break;

    case 'resize':
      // Resize from phone
      if (ptyProcess && message.cols && message.rows) {
        ptyProcess.resize(message.cols, message.rows);
      }
      break;

    default:
      console.log(chalk.dim(`  Unknown message: ${message.type}`));
  }
}

function showQRCode() {
  const connectionUrl = `${WEB_APP_URL}/session/${sessionId}?token=${sessionToken}`;

  console.log(chalk.dim('  Scan this QR code with your phone to connect:\n'));

  qrcode.generate(connectionUrl, { small: true }, (qr) => {
    console.log(qr);
    console.log(chalk.dim(`\n  Or open: ${chalk.underline(connectionUrl)}\n`));
    console.log(chalk.dim(`  Session ID: ${sessionId}`));
    console.log(chalk.dim(`  Waiting for phone connection...\n`));
    console.log(chalk.dim('─'.repeat(cols)));
  });
}

function startPTY() {
  // Initialize PTY
  ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: process.cwd(),
    env: process.env,
  });

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
    console.log(chalk.dim(`\n  Session ended (exit code: ${exitCode})`));
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
