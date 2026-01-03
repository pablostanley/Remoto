'use client';

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, Terminal, Command, Info, Heartbeat, ArrowSquareOut, SignOut, Copy, Check } from "@phosphor-icons/react";

const DOCS_CONTENT = `# Remoto Documentation

## How it works

Remoto creates a secure tunnel between your terminal and your phone. When you run the CLI, it spawns a local shell session and connects to our relay server via WebSocket.

Scanning the QR code opens a web-based terminal on your phone that connects to the same session. Everything you type on your phone is sent to your local terminal, and all output is streamed back in real-time.

- Sessions expire after 1 hour
- Up to 5 concurrent sessions on free plan
- Sensitive environment variables are filtered out

## Getting started

1. Install globally
   $ npm install -g remotosh

2. Start a session
   $ remoto

3. Scan the QR code with your phone

## CLI commands

- remoto: Start a new terminal session and display the QR code
- remoto status: Check if you're logged in
- remoto doctor: Run diagnostics to check Node.js version, network connectivity, and node-pty
- remoto open: Open the Remoto dashboard in your browser
- remoto logout: Clear saved authentication token
- remoto help: Show all available commands

## Troubleshooting

### posix_spawnp failed or spawn-helper errors
This usually means node-pty needs to be rebuilt for your system. Install globally to fix:
$ npm install -g remotosh

### Session limit reached
Free accounts can have up to 5 concurrent sessions. End existing sessions from the dashboard or press Ctrl+C in active terminal sessions.

### Run diagnostics
Use the doctor command to check your setup:
$ remoto doctor

## Security

Remoto is designed with security in mind:
- Sessions require two tokens: one from authentication, one from session creation
- Sensitive environment variables (API keys, secrets, tokens) are automatically filtered
- All connections use TLS encryption
- Sessions expire automatically after 1 hour
- Terminal output is streamed but not stored on our servers
`;

export default function DocsPage() {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const supabase = createClient();

  const handleCopyDocs = async () => {
    await navigator.clipboard.writeText(DOCS_CONTENT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  return (
    <main className="min-h-screen p-8 md:p-16 max-w-2xl mx-auto">
      <nav className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image src="/logo.svg" alt="Remoto" width={28} height={28} />
            <span className="text-lg font-medium">remoto</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">docs</span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <Link href="/dashboard">
              <Button variant="secondary" size="sm">Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Log in
              </Link>
              <Link href="/signup">
                <Button variant="secondary" size="sm">Sign up</Button>
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className="space-y-12">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={16} />
              Back to home
            </Link>
            <button
              onClick={handleCopyDocs}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              title="Copy docs for LLM"
            >
              {copied ? (
                <>
                  <Check size={16} weight="bold" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copy page
                </>
              )}
            </button>
          </div>
          <h1 className="text-4xl font-medium tracking-tight">Documentation</h1>
          <p className="text-muted-foreground text-lg">
            Learn how to use Remoto to control your terminal from your phone.
          </p>
        </div>

        {/* How it works */}
        <section className="space-y-6">
          <h2 className="text-xl font-medium">How it works</h2>
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Remoto creates a secure tunnel between your terminal and your phone. When you run the CLI,
              it spawns a local shell session and connects to our relay server via WebSocket.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Scanning the QR code opens a web-based terminal on your phone that connects to the same session.
              Everything you type on your phone is sent to your local terminal, and all output is streamed back in real-time.
            </p>
            <div className="pt-2 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground mt-2"></span>
                <span className="text-muted-foreground">Sessions expire after 1 hour</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground mt-2"></span>
                <span className="text-muted-foreground">Up to 5 concurrent sessions on free plan</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground mt-2"></span>
                <span className="text-muted-foreground">Sensitive environment variables are filtered out</span>
              </div>
            </div>
          </div>
        </section>

        {/* Getting started */}
        <section className="space-y-6">
          <h2 className="text-xl font-medium">Getting started</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">1</span>
              <div className="space-y-2 flex-1">
                <p className="text-sm font-medium">Install globally</p>
                <code className="block bg-card border border-border rounded-lg p-4 font-mono text-sm">
                  <span className="text-muted-foreground select-none">$ </span>npm install -g remotosh
                </code>
              </div>
            </div>

            <div className="flex gap-4">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">2</span>
              <div className="space-y-2 flex-1">
                <p className="text-sm font-medium">Start a session</p>
                <code className="block bg-card border border-border rounded-lg p-4 font-mono text-sm">
                  <span className="text-muted-foreground select-none">$ </span>remoto
                </code>
              </div>
            </div>

            <div className="flex gap-4">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">3</span>
              <p className="text-sm pt-0.5">Scan the QR code with your phone</p>
            </div>
          </div>
        </section>

        {/* CLI Commands */}
        <section className="space-y-6">
          <h2 className="text-xl font-medium">CLI commands</h2>
          <p className="text-muted-foreground">
            The <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono">remoto</code> CLI supports the following commands:
          </p>

          <div className="space-y-3">
            <CommandCard
              icon={<Terminal size={18} />}
              command="remoto"
              description="Start a new terminal session and display the QR code"
            />
            <CommandCard
              icon={<Info size={18} />}
              command="remoto status"
              description="Check if you're logged in"
            />
            <CommandCard
              icon={<Heartbeat size={18} />}
              command="remoto doctor"
              description="Run diagnostics to check Node.js version, network connectivity, and node-pty"
            />
            <CommandCard
              icon={<ArrowSquareOut size={18} />}
              command="remoto open"
              description="Open the Remoto dashboard in your browser"
            />
            <CommandCard
              icon={<SignOut size={18} />}
              command="remoto logout"
              description="Clear saved authentication token"
            />
            <CommandCard
              icon={<Command size={18} />}
              command="remoto help"
              description="Show all available commands"
            />
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="space-y-6">
          <h2 className="text-xl font-medium">Troubleshooting</h2>

          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-6 space-y-3">
              <h3 className="font-medium">posix_spawnp failed or spawn-helper errors</h3>
              <p className="text-sm text-muted-foreground">
                This usually means node-pty needs to be rebuilt for your system. Install globally to fix:
              </p>
              <code className="block bg-muted rounded-lg p-3 font-mono text-sm">
                npm install -g remotosh
              </code>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-3">
              <h3 className="font-medium">Session limit reached</h3>
              <p className="text-sm text-muted-foreground">
                Free accounts can have up to 5 concurrent sessions. End existing sessions from the{" "}
                <Link href="/dashboard/sessions" className="underline hover:text-foreground">dashboard</Link> or press Ctrl+C in active terminal sessions.
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-3">
              <h3 className="font-medium">Run diagnostics</h3>
              <p className="text-sm text-muted-foreground">
                Use the doctor command to check your setup:
              </p>
              <code className="block bg-muted rounded-lg p-3 font-mono text-sm">
                remoto doctor
              </code>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="space-y-6">
          <h2 className="text-xl font-medium">Security</h2>
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Remoto is designed with security in mind:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground mt-2"></span>
                <span>Sessions require two tokens: one from authentication, one from session creation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground mt-2"></span>
                <span>Sensitive environment variables (API keys, secrets, tokens) are automatically filtered</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground mt-2"></span>
                <span>All connections use TLS encryption</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground mt-2"></span>
                <span>Sessions expire automatically after 1 hour</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground mt-2"></span>
                <span>Terminal output is streamed but not stored on our servers</span>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <footer className="mt-24 text-sm text-muted-foreground">
        send feedback to <a href="https://x.com/pablostanley" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">pablo stanley</a>
      </footer>
    </main>
  );
}

function CommandCard({ icon, command, description }: { icon: React.ReactNode; command: string; description: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <code className="font-mono text-sm font-medium">{command}</code>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}
