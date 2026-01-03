'use client';

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Check, Copy } from "@phosphor-icons/react";

export default function Home() {
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText('npm install -g remotosh && remoto');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen p-8 md:p-16 max-w-2xl mx-auto">
      <nav className="flex items-center justify-between mb-16">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Remoto" width={28} height={28} />
          <span className="text-lg font-medium">remoto</span>
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">beta</span>
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

      <div className="space-y-6">
        <h1 className="text-4xl font-medium tracking-tight">
          Terminal in your pocket
        </h1>

        <p className="text-muted-foreground text-lg leading-relaxed">
          Run commands, monitor output, and get notifications when tasks complete.
          Free to use. Still experimental.
        </p>

        <div className="pt-4 space-y-6">
          <p className="text-sm font-medium">How it works:</p>

          <div className="space-y-4">
            <div className="flex gap-4">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">1</span>
              <div className="space-y-2 flex-1">
                <p className="text-sm">Run this command in your terminal</p>
                <div className="bg-card border border-border rounded-lg p-4 font-mono text-sm flex items-center justify-between gap-2">
                  <div>
                    <span className="text-muted-foreground select-none">$ </span>
                    <span className="text-foreground">npm install -g remotosh && remoto</span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <Check size={16} weight="bold" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">2</span>
              <p className="text-sm pt-0.5">Scan the QR code with your phone</p>
            </div>

            <div className="flex gap-4">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">3</span>
              <p className="text-sm pt-0.5">Control your terminal from anywhere</p>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
            <span>Optimized for AI agents like <a href="https://claude.ai/download" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Claude Code</a> or <a href="https://v0.dev" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">v0</a></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
            <span>Real-time terminal streaming</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
            <span>Touch-friendly keyboard</span>
          </div>
        </div>
      </div>

      <footer className="mt-24 text-sm text-muted-foreground flex flex-col gap-2">
        <div>
          <Link href="/docs" className="hover:text-foreground transition-colors">docs</Link>
          <span className="mx-2">·</span>
          <a href="https://x.com/pablostanley" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">feedback</a>
        </div>
      </footer>
    </main>
  );
}
