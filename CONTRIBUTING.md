# Contributing to Remoto

Thanks for your interest in contributing to Remoto! This guide will help you get started.

## Project Structure

```
remoto/
├── cli/          # Node.js CLI (npm: remotosh)
├── server/       # WebSocket relay server (Fly.io)
└── web/          # Next.js web app (Vercel)
```

## Local Development Setup

### Prerequisites

- Node.js 18+
- npm
- A Supabase project (free tier works)

### 1. Clone the repo

```bash
git clone https://github.com/pablostanley/Remoto.git
cd Remoto
```

### 2. Set up the web app

```bash
cd web
cp .env.example .env.local
npm install
```

Edit `.env.local` with your Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key

```bash
npm run dev
```

### 3. Set up the WebSocket server

```bash
cd server
cp .env.example .env
npm install
```

Edit `.env` with your Supabase credentials:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key

```bash
npm run dev
```

### 4. Set up the CLI

```bash
cd cli
npm install
npm link  # Makes 'remoto' command available globally
```

For local development, set these environment variables:
```bash
export REMOTO_WS_URL=ws://localhost:8080
export REMOTO_WEB_URL=http://localhost:3000
```

## Common Issues

### `posix_spawnp failed` or `spawn-helper` errors

This means node-pty needs to be rebuilt for your system:

```bash
npm uninstall -g remotosh && npm install -g remotosh
```

If that doesn't work, install build tools:
- **macOS**: `xcode-select --install`
- **Linux**: `sudo apt install build-essential`

Run `remoto doctor` for diagnostics.

## Pull Requests

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/cool-thing`)
3. Make your changes
4. Test locally
5. Commit with a descriptive message
6. Push and open a PR

## Security

- Never commit `.env` files or secrets
- The CLI filters sensitive environment variables (see `SENSITIVE_ENV_PATTERNS` in `cli/bin/remoto.js`)
- Report security issues privately to pablo@remoto.sh

## Questions?

Open an issue or reach out on Twitter [@pablostanley](https://twitter.com/pablostanley).
