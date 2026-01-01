import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen p-8 md:p-16 max-w-2xl">
      <nav className="flex items-center justify-between mb-16">
        <span className="text-lg font-medium">remoto</span>
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
          Control your terminal from your phone
        </h1>

        <p className="text-muted-foreground text-lg leading-relaxed">
          Run commands, monitor output, and get notifications when tasks complete.
          No account required.
        </p>

        <div className="pt-4 space-y-4">
          <p className="text-sm text-muted-foreground">Get started:</p>
          <div className="bg-card border border-border rounded-lg p-4 font-mono text-sm">
            <span className="text-muted-foreground select-none">$ </span>
            <span className="text-foreground">npx remoto</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Scan the QR code with your phone to connect.
          </p>
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
        <Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link>
        <span className="mx-3">·</span>
        <Link href="https://github.com/pablostanley/Remoto" className="hover:text-foreground transition-colors">GitHub</Link>
      </footer>
    </main>
  );
}
