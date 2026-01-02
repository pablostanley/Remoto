'use client';

import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { TacoLogo } from '@/components/TacoLogo';
import { Button } from '@/components/ui/button';

function CLIAuthContent() {
  const [authorizing, setAuthorizing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const supabase = createClient();

  useEffect(() => {
    // Check if user is logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user);
      } else {
        // Redirect to login with return URL
        router.push(`/login?next=${encodeURIComponent(`/cli-auth?code=${code}`)}`);
      }
    });
  }, [code, router, supabase.auth]);

  const handleAuthorize = async () => {
    if (!code || authorizing) return;
    setAuthorizing(true);
    setError(null);

    try {
      const response = await fetch('/api/cli-auth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (data.success) {
        setAuthorized(true);
      } else {
        setError(data.error || 'Failed to authorize');
      }
    } catch (e) {
      setError('Something went wrong');
    }

    setAuthorizing(false);
  };

  const handleCancel = () => {
    window.close();
  };

  if (!code) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <TacoLogo size={64} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Invalid request</h1>
          <p className="text-muted-foreground">No device code provided</p>
        </div>
      </main>
    );
  }

  if (authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <TacoLogo size={64} />
          </div>
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-2">Authorized!</h1>
          <p className="text-muted-foreground mb-6">
            You can close this window and return to your terminal.
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <TacoLogo size={64} />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <TacoLogo size={64} />
        </div>

        <h1 className="text-2xl font-bold mb-2">Authorize CLI</h1>
        <p className="text-muted-foreground mb-6">
          The Remoto CLI is requesting access to your account
        </p>

        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground mb-1">Logged in as</p>
          <p className="text-foreground font-medium">{user.email}</p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <Button onClick={handleAuthorize} disabled={authorizing} className="w-full">
            {authorizing ? 'Authorizing...' : 'Authorize'}
          </Button>

          <button
            onClick={handleCancel}
            className="w-full text-muted-foreground hover:text-foreground py-2 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </main>
  );
}

export default function CLIAuthPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <TacoLogo size={64} />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    }>
      <CLIAuthContent />
    </Suspense>
  );
}
