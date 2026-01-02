'use client';

import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { TacoLogo } from '@/components/TacoLogo';
import { Button } from '@/components/ui/button';

function VerifyEmailContent() {
  const [checking, setChecking] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const supabase = createClient();

  // Poll for session (user confirmed email)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      }
    };

    // Check immediately
    checkSession();

    // Then poll every 3 seconds
    const interval = setInterval(checkSession, 3000);

    return () => clearInterval(interval);
  }, [router, supabase.auth]);

  const handleResend = async () => {
    if (!email || checking) return;
    setChecking(true);

    await supabase.auth.resend({
      type: 'signup',
      email,
    });

    setChecking(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <TacoLogo size={64} />
        </div>

        <h1 className="text-2xl font-bold mb-2">Check your email</h1>
        <p className="text-muted-foreground mb-6">
          We sent a confirmation link to{' '}
          {email ? <span className="text-foreground">{email}</span> : 'your email'}
        </p>

        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            Click the link in your email to confirm your account. This page will automatically redirect once confirmed.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="secondary"
            onClick={handleResend}
            disabled={checking || !email}
            className="w-full"
          >
            {checking ? 'Sending...' : 'Resend email'}
          </Button>

          <button
            onClick={() => router.push('/login')}
            className="w-full text-muted-foreground hover:text-foreground py-2 text-sm transition-colors"
          >
            Back to sign in
          </button>
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <TacoLogo size={64} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Check your email</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
