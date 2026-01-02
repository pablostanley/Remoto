'use client';

import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { TacoLogo } from '@/components/TacoLogo';

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
        <p className="text-gray-400 mb-6">
          We sent a confirmation link to{' '}
          {email ? <span className="text-white">{email}</span> : 'your email'}
        </p>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-400">
            Click the link in your email to confirm your account. This page will automatically redirect once confirmed.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleResend}
            disabled={checking || !email}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {checking ? 'Sending...' : 'Resend email'}
          </button>

          <button
            onClick={() => router.push('/login')}
            className="w-full text-gray-400 hover:text-white py-2 text-sm transition-colors"
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
          <p className="text-gray-400">Loading...</p>
        </div>
      </main>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
