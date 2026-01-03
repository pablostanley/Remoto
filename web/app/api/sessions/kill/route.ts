import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const WS_SERVER_URL = process.env.WS_SERVER_URL || 'https://remoto-ws.fly.dev';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    // Verify user owns this session
    const { data: session } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Call the WebSocket server to kill the session
    if (SUPABASE_SERVICE_KEY) {
      try {
        await fetch(`${WS_SERVER_URL}/api/kill-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ sessionId }),
        });
      } catch (err) {
        console.error('Failed to kill session on server:', err);
        // Continue anyway - we'll still update the database
      }
    }

    // Update session in database
    await supabase
      .from('sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error killing session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
