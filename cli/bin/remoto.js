#!/usr/bin/env node

// Check for Bun runtime - node-pty doesn't work with Bun
if (typeof Bun !== 'undefined') {
  console.error('\n  Remoto requires Node.js to run.');
  console.error('  Please use: npx remotosh');
  console.error('  (bunx is not supported due to native module limitations)\n');
  process.exit(1);
}

import os from 'os';
import fs from 'fs';
import path from 'path';
import pty from 'node-pty';
import qrcode from 'qrcode-terminal';
import WebSocket from 'ws';
import chalk from 'chalk';
import { randomBytes } from 'crypto';

// Configuration
const WS_SERVER_URL = process.env.REMOTO_WS_URL || 'wss://remoto-ws.fly.dev';
const WEB_APP_URL = process.env.REMOTO_WEB_URL || 'https://www.remoto.sh';
const CONFIG_DIR = path.join(os.homedir(), '.remoto');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Sensitive environment variable patterns to filter out
const SENSITIVE_ENV_PATTERNS = [
  /^AWS_/i, /^AZURE_/i, /^GCP_/i, /^GOOGLE_/i,
  /^GITHUB_TOKEN$/i, /^GH_TOKEN$/i, /^GITLAB_/i,
  /^NPM_TOKEN$/i, /^DOCKER_/i, /^KUBERNETES_/i, /^K8S_/i,
  /SECRET/i, /PASSWORD/i, /PRIVATE_KEY/i, /API_KEY/i,
  /AUTH_TOKEN/i, /ACCESS_TOKEN/i, /REFRESH_TOKEN/i,
  /DATABASE_URL/i, /DB_PASSWORD/i, /POSTGRES_/i, /MYSQL_/i, /MONGO_/i, /REDIS_/i,
  /STRIPE_/i, /TWILIO_/i, /SENDGRID_/i, /MAILGUN_/i,
  /SUPABASE_/i, /FIREBASE_/i, /OPENAI_/i, /ANTHROPIC_/i, /SLACK_/i, /DISCORD_/i,
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

// Load saved config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    // Ignore errors
  }
  return {};
}

// Save config
function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  } catch (e) {
    // Ignore errors
  }
}

// Open URL in browser
async function openBrowser(url) {
  const { exec } = await import('child_process');
  const platform = os.platform();

  let command;
  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (err) => {
    if (err) {
      console.log(chalk.dim(`  couldn't open browser automatically`));
      console.log(chalk.dim(`  open this URL manually: ${url}`));
    }
  });
}

// Poll for auth completion
async function pollForAuth(deviceCode) {
  const pollUrl = `${WEB_APP_URL}/api/cli-auth/poll?code=${deviceCode}`;

  for (let i = 0; i < 60; i++) { // Poll for 5 minutes max
    await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds

    try {
      const response = await fetch(pollUrl);
      const data = await response.json();

      if (data.status === 'authorized' && data.token) {
        return data.token;
      } else if (data.status === 'expired') {
        return null;
      }
      // status === 'pending' - keep polling
    } catch (e) {
      // Network error, keep trying
    }
  }

  return null;
}

// Main auth flow
async function authenticate() {
  const config = loadConfig();

  // Check if we have a saved token
  if (config.token) {
    return config.token;
  }

  // No token - need to authenticate via browser
  console.log(chalk.yellow('  login required\n'));

  // Generate device code
  const deviceCode = randomBytes(16).toString('hex');
  const authUrl = `${WEB_APP_URL}/cli-auth?code=${deviceCode}`;

  console.log(chalk.white('  opening browser to login...\n'));

  await openBrowser(authUrl);

  console.log(chalk.dim(`  if browser didn't open, go to:`));
  console.log(chalk.cyan(`  ${authUrl}\n`));
  console.log(chalk.dim('  waiting for login...'));

  const token = await pollForAuth(deviceCode);

  if (!token) {
    console.log(chalk.red('\n  login timed out or was cancelled'));
    console.log(chalk.dim('  run `npx remotosh` to try again\n'));
    process.exit(1);
  }

  // Save token
  saveConfig({ token });
  console.log(chalk.green('\n  logged in successfully!\n'));

  return token;
}

// Detect shell
const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'zsh');

// Terminal dimensions
let cols = process.stdout.columns || 80;
let rows = process.stdout.rows || 24;

// Version
const VERSION = '1.3.4';

// Show help
function showHelp() {
  console.log(chalk.bold.white('\n  remoto') + chalk.dim(` v${VERSION}`));
  console.log(chalk.dim('  control your terminal from your phone\n'));
  console.log('  ' + chalk.bold('Usage:'));
  console.log('    remoto              Start a new session');
  console.log('    remoto status       Check login status');
  console.log('    remoto logout       Log out and clear saved token');
  console.log('    remoto doctor       Diagnose common issues');
  console.log('    remoto open         Open dashboard in browser');
  console.log('    remoto help         Show this help message');
  console.log('    remoto --version    Show version\n');
  console.log('  ' + chalk.bold('More info:'));
  console.log(chalk.dim('    https://remoto.sh\n'));
}

// Show version
function showVersion() {
  console.log(`remotosh v${VERSION}`);
}

// Check status
function showStatus() {
  const config = loadConfig();
  console.log(chalk.bold.white('\n  remoto status\n'));
  if (config.token) {
    console.log(chalk.green('  ✓ logged in'));
    console.log(chalk.dim('    token saved in ~/.remoto/config.json\n'));
  } else {
    console.log(chalk.yellow('  ✗ not logged in'));
    console.log(chalk.dim('    run `remoto` to log in\n'));
  }
}

// Run diagnostics
async function runDoctor() {
  console.log(chalk.bold.white('\n  remoto doctor\n'));
  let issues = 0;

  // Check Node version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (majorVersion >= 18) {
    console.log(chalk.green(`  ✓ Node.js ${nodeVersion}`));
  } else {
    console.log(chalk.red(`  ✗ Node.js ${nodeVersion} (need v18+)`));
    issues++;
  }

  // Check node-pty
  try {
    const ptyTest = pty.spawn(shell, [], { cols: 80, rows: 24 });
    ptyTest.kill();
    console.log(chalk.green('  ✓ node-pty working'));
  } catch (err) {
    console.log(chalk.red('  ✗ node-pty failed: ' + err.message));
    console.log(chalk.dim('    try: npm uninstall -g remotosh && npm install -g remotosh'));
    issues++;
  }

  // Check network connectivity
  try {
    const response = await fetch(`${WEB_APP_URL}`, { method: 'HEAD' });
    if (response.ok) {
      console.log(chalk.green('  ✓ network connectivity'));
    } else {
      console.log(chalk.yellow('  ? network: server returned ' + response.status));
    }
  } catch (err) {
    console.log(chalk.red('  ✗ network: cannot reach remoto.sh'));
    issues++;
  }

  // Check config
  const config = loadConfig();
  if (config.token) {
    console.log(chalk.green('  ✓ logged in'));
  } else {
    console.log(chalk.yellow('  ○ not logged in (run `remoto` to log in)'));
  }

  console.log('');
  if (issues === 0) {
    console.log(chalk.green('  all good!\n'));
  } else {
    console.log(chalk.yellow(`  found ${issues} issue${issues > 1 ? 's' : ''}\n`));
  }
}

// Open dashboard in browser
async function openDashboard() {
  console.log(chalk.dim('\n  opening dashboard...\n'));
  await openBrowser(`${WEB_APP_URL}/dashboard`);
}

// Main
async function main() {
  const command = process.argv[2];

  // Handle commands
  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      process.exit(0);

    case '--version':
    case '-v':
      showVersion();
      process.exit(0);

    case 'status':
      showStatus();
      process.exit(0);

    case 'logout':
      saveConfig({});
      console.log(chalk.green('\n  logged out successfully\n'));
      process.exit(0);

    case 'doctor':
      await runDoctor();
      process.exit(0);

    case 'open':
      await openDashboard();
      process.exit(0);

    case undefined:
      // No command - start session (fall through)
      break;

    default:
      // Unknown command
      console.log(chalk.red(`\n  unknown command: ${command}\n`));
      showHelp();
      process.exit(1);
  }

  // Start session
  console.clear();
  console.log(chalk.bold.white('\n  remoto'));
  console.log(chalk.dim('  control your terminal from your phone\n'));

  // Authenticate
  const token = await authenticate();

  console.log(chalk.dim('  connecting...'));

  // Connect to WebSocket server
  const wsUrl = `${WS_SERVER_URL}/cli/?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(wsUrl);

  let ptyProcess = null;
  let sessionId = null;
  let sessionToken = null;
  let maxDuration = null;
  let outputBuffer = '';
  let flushTimeout = null;

  ws.on('open', () => {
    // Connection established, wait for session_created message
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleServerMessage(message);
    } catch (err) {
      // Ignore invalid messages
    }
  });

  ws.on('close', (code, reason) => {
    const reasonStr = reason?.toString() || '';

    if (code === 4001 || code === 4002) {
      // Invalid/expired token - clear it and re-auth
      saveConfig({});
      console.log(chalk.yellow('\n  session expired, please login again'));
      console.log(chalk.dim('  run `npx remotosh` to login\n'));
    } else if (code === 4004) {
      console.log(chalk.yellow('\n  session limit reached'));
      console.log(chalk.dim('  free plan allows 5 concurrent sessions'));
      console.log(chalk.dim('  close an existing session and try again\n'));
    } else if (reasonStr.includes('expired')) {
      console.log(chalk.yellow('\n  session expired (1 hour limit)'));
      console.log(chalk.dim('  run `npx remotosh` to start a new session\n'));
    } else {
      console.log(chalk.dim(`\n  disconnected\n`));
    }
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
        maxDuration = message.maxDuration;
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

      case 'session_expiring':
        console.log(chalk.yellow(`\n  session expiring in ${message.minutesRemaining} minutes\n`));
        break;

      case 'input':
        if (ptyProcess) {
          ptyProcess.write(message.data);
        }
        break;

      case 'resize':
        if (ptyProcess && message.cols && message.rows) {
          ptyProcess.resize(message.cols, message.rows);
        }
        break;
    }
  }

  function showQRCode() {
    const connectionUrl = `${WEB_APP_URL}/session/${sessionId}?token=${sessionToken}`;
    const durationMinutes = maxDuration ? Math.floor(maxDuration / 60000) : 60;

    console.clear();
    console.log(chalk.bold.white('\n  remoto'));
    console.log(chalk.dim('  control your terminal from your phone\n'));

    qrcode.generate(connectionUrl, { small: true }, (qr) => {
      const indentedQr = qr.split('\n').map(line => '  ' + line).join('\n');
      console.log(indentedQr);
      console.log(chalk.dim(`\n  ${connectionUrl}\n`));
      console.log(chalk.dim('  scan the qr code or open the link on your phone'));
      console.log(chalk.dim(`  session expires in ${durationMinutes} minutes`));
      console.log(chalk.dim('  waiting for connection...\n'));
      console.log(chalk.dim('─'.repeat(Math.min(cols, 60))));
    });
  }

  function startPTY() {
    try {
      const sanitizedEnv = getSanitizedEnv();
      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: process.cwd(),
        env: sanitizedEnv,
      });
    } catch (err) {
      console.error(chalk.red(`  failed to start shell: ${err.message}`));
      return;
    }

    ptyProcess.onData((data) => {
      process.stdout.write(data);
      outputBuffer += data;

      if (flushTimeout) clearTimeout(flushTimeout);
      flushTimeout = setTimeout(() => {
        if (outputBuffer && ws.readyState === WebSocket.OPEN) {
          const chunks = chunkString(outputBuffer, 16000);
          for (const chunk of chunks) {
            ws.send(JSON.stringify({ type: 'output', data: chunk }));
          }
          outputBuffer = '';
        }
      }, 30);
    });

    ptyProcess.onExit(({ exitCode }) => {
      console.log(chalk.dim(`\n  session ended`));
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
        ws.close();
      }
      process.exit(exitCode);
    });

    process.stdout.on('resize', () => {
      cols = process.stdout.columns;
      rows = process.stdout.rows;
      if (ptyProcess) {
        ptyProcess.resize(cols, rows);
      }
    });

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

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

function chunkString(str, size) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks.length ? chunks : [''];
}

main().catch(err => {
  console.error(chalk.red(`  error: ${err.message}`));
  process.exit(1);
});
