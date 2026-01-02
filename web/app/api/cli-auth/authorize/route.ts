import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

export async function POST(request: Request) {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { code } = await request.json();
  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  // Generate a CLI token
  const token = `cli_${nanoid(32)}`;

  // Store the token in cli_tokens table (permanent storage)
  const { error: tokenError } = await supabase.from('cli_tokens').insert({
    user_id: user.id,
    token,
  });

  if (tokenError) {
    console.error('Failed to store CLI token:', tokenError);
    return NextResponse.json({ error: 'Failed to store token', details: tokenError.message }, { status: 500 });
  }

  // Store the pending auth with the token (temporary, for CLI to poll)
  const { error } = await supabase.from('cli_auth_requests').upsert({
    code,
    user_id: user.id,
    token,
    status: 'authorized',
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes to poll
  });

  if (error) {
    console.error('Failed to store CLI auth request:', error);
    // Clean up the token we just created
    await supabase.from('cli_tokens').delete().eq('token', token);
    return NextResponse.json({ error: 'Failed to store auth request', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
