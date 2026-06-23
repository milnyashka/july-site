import { createServiceClient } from '@/lib/supabase/server';
import { parseSellixTopupAmount, verifySellixWebhook } from '@/lib/sellix';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('X-Sellix-Signature');

  if (!verifySellixWebhook(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  if (payload.event !== 'order:paid' && payload.event !== 'order:completed') {
    return NextResponse.json({ ok: true });
  }

  const order = payload.data ?? payload;
  const email = order.customer_email ?? order.buyer_email;
  const productTitle = order.product_title ?? order.title ?? '';
  const amount = parseSellixTopupAmount(productTitle) ?? parseFloat(order.total ?? order.price);

  if (!email || !amount || amount <= 0) {
    return NextResponse.json({ ok: true });
  }

  const service = createServiceClient();

  const { data: profile } = await service
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (!profile) {
    return NextResponse.json({ ok: true });
  }

  const externalId = String(order.uniqid ?? order.id ?? '');

  const { data: existing } = await service
    .from('topup_requests')
    .select('id')
    .eq('external_id', externalId)
    .eq('status', 'paid')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true });
  }

  const { data: topup } = await service
    .from('topup_requests')
    .insert({
      user_id: profile.id,
      amount,
      method: 'card',
      status: 'pending',
      external_id: externalId,
    })
    .select('id')
    .single();

  if (topup) {
    await service.rpc('add_balance', {
      p_user_id: profile.id,
      p_amount: amount,
      p_description: 'topup:card',
      p_topup_id: topup.id,
    });
  }

  return NextResponse.json({ ok: true });
}