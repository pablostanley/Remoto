import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const WS_SERVER_URL = process.env.WS_SERVER_URL || 'https://remoto-ws.fly.dev';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call the WebSocket server to kill all sessions for this user
    if (SUPABASE_SERVICE_KEY) {
      try {
        await fetch(`${WS_SERVER_URL}/api/kill-all-sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ userId: user.id }),
        });
      } catch (err) {
        console.error('Failed to kill sessions on server:', err);
      }
    }

    // Update all active sessions in database
    await supabase
      .from('sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('status', 'active');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error killing all sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
