'use client';

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function Home() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText('npx remotosh');
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
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Log in
          </Link>
          <Link href="/signup">
            <Button variant="secondary" size="sm">Sign up</Button>
          </Link>
        </div>
      </nav>

      <div className="space-y-6">
        <h1 className="text-4xl font-medium tracking-tight">
          Terminal in your pocket
        </h1>

        <p className="text-muted-foreground text-lg leading-relaxed">
          Run commands, monitor output, and get notifications when tasks complete.
          No account required. Still experimental.
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
                    <span className="text-foreground">npx remotosh</span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                      </svg>
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
            <span>Real-time terminal streaming</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
            <span>Touch-friendly keyboard</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
            <span>End-to-end encrypted</span>
          </div>
        </div>
      </div>

      <footer className="mt-24 text-sm text-muted-foreground">
        send feedback to <a href="https://x.com/pablostanley" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">pablo stanley</a>
      </footer>
    </main>
  );
}
