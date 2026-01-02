import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ status: 'error', error: 'No code provided' }, { status: 400 });
  }

  const supabase = await createClient();

  // Look up the auth request
  const { data, error } = await supabase
    .from('cli_auth_requests')
    .select('token, status, expires_at')
    .eq('code', code)
    .single();

  if (error || !data) {
    return NextResponse.json({ status: 'pending' });
  }

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ status: 'expired' });
  }

  if (data.status === 'authorized' && data.token) {
    // Delete the request after successful auth (one-time use)
    await supabase.from('cli_auth_requests').delete().eq('code', code);

    return NextResponse.json({
      status: 'authorized',
      token: data.token,
    });
  }

  return NextResponse.json({ status: 'pending' });
}
