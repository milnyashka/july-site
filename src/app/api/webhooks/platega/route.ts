import { createServiceClient } from '@/lib/supabase/server';
import { parsePlategaCallback, verifyPlategaWebhook } from '@/lib/platega';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  if (!verifyPlategaWebhook(request)) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const rawBody = await request.text();
  const payload = parsePlategaCallback(rawBody);

  if (!payload) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: topupByExternal } = await service
    .from('topup_requests')
    .select('id, user_id, amount, status')
    .eq('external_id', payload.id)
    .maybeSingle();

  let topup = topupByExternal;

  if (!topup && payload.payload) {
    const { data: topupByPayload } = await service
      .from('topup_requests')
      .select('id, user_id, amount, status')
      .eq('id', payload.payload)
      .maybeSingle();
    topup = topupByPayload;
  }

  if (!topup) {
    return NextResponse.json({ ok: true });
  }

  if (topup.status === 'paid') {
    return NextResponse.json({ ok: true });
  }

  const status = payload.status.toUpperCase();

  if (status === 'CONFIRMED') {
    const paidAmount = Number(payload.amount);
    if (!paidAmount || Math.abs(paidAmount - Number(topup.amount)) > 0.01) {
      return NextResponse.json({ error: 'amount_mismatch' }, { status: 400 });
    }

    await service.rpc('add_balance', {
      p_user_id: topup.user_id,
      p_amount: topup.amount,
      p_description: 'topup:sbp',
      p_topup_id: topup.id,
    });

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