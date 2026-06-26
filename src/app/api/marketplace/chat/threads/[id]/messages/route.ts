import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

async function assertParticipant(supabase: Awaited<ReturnType<typeof createClient>>, threadId: string, userId: string) {
  const { data } = await supabase
    .from('marketplace_threads')
    .select('id, buyer_id, seller_id')
    .eq('id', threadId)
    .single();

  if (!data || (data.buyer_id !== userId && data.seller_id !== userId)) {
    return null;
  }
  return data;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const thread = await assertParticipant(supabase, id, user.id);
  if (!thread) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('marketplace_messages')
    .select('id, thread_id, sender_id, body, created_at')
    .eq('thread_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  const messages = (data ?? []).map((m) => ({
    id: m.id,
    threadId: m.thread_id,
    senderId: m.sender_id,
    body: m.body,
    createdAt: m.created_at,
    isMine: m.sender_id === user.id,
  }));

  return NextResponse.json({ messages });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const thread = await assertParticipant(supabase, id, user.id);
  if (!thread) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { body } = await request.json();
  const text = typeof body === 'string' ? body.trim() : '';

  if (!text || text.length > 2000) {
    return NextResponse.json({ error: 'invalid_message' }, { status: 400 });
  }

  const { data: msg, error } = await supabase
    .from('marketplace_messages')
    .insert({
      thread_id: id,
      sender_id: user.id,
      body: text,
    })
    .select('id, thread_id, sender_id, body, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: 'server_error', detail: error.message }, { status: 500 });
  }

  await supabase
    .from('marketplace_threads')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json({
    message: {
      id: msg.id,
      threadId: msg.thread_id,
      senderId: msg.sender_id,
      body: msg.body,
      createdAt: msg.created_at,
      isMine: true,
    },
  });
}