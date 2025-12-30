import Pusher from 'pusher';
import { NextRequest, NextResponse } from 'next/server';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const { command, token, type = 'command' } = body;

    // Send command to CLI via Pusher
    await pusher.trigger(`session-${sessionId}`, type, {
      command,
      token,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending command:', error);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
