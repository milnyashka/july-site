import { createServiceClient } from '@/lib/supabase/server';
import { parsePlategaCallback, verifyPlategaWebhook } from '@/lib/platega';
import { creditPlategaTopup, findTopupForCallback } from '@/lib/platega-topup';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const payload = parsePlategaCallback(rawBody);

  if (!payload) {
    console.error('[platega/webhook] invalid payload:', rawBody);
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const hasAuthHeaders =
    request.headers.has('X-MerchantId') || request.headers.has('X-Secret');

  if (hasAuthHeaders && !verifyPlategaWebhook(request)) {
    console.error('[platega/webhook] invalid credentials');
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const service = createServiceClient();
  const topup = await findTopupForCallback(service, payload);

  if (!topup) {
    console.warn('[platega/webhook] topup not found:', payload.id, payload.payload);
    return NextResponse.json({ ok: true });
  }

  const status = payload.status.toUpperCase();

  if (status === 'CONFIRMED') {
    const result = await creditPlategaTopup(service, topup, payload);
    if (!result.credited && result.reason === 'amount_mismatch') {
      console.error('[platega/webhook] amount mismatch:', payload, topup);
      return NextResponse.json({ error: 'amount_mismatch' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (status === 'CANCELED') {
    await service
      .from('topup_requests')
      .update({ status: 'failed' })
      .eq('id', topup.id)
      .eq('status', 'pending');
    return NextResponse.json({ ok: true });
  }

  if (status === 'CHARGEBACK' || status === 'CHARGEBACKED') {
    await service
      .from('topup_requests')
      .update({ status: 'failed' })
      .eq('id', topup.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}