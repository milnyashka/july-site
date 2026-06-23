import { createServiceClient } from '@/lib/supabase/server';
import { verifyCryptomusWebhook } from '@/lib/cryptomus';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyCryptomusWebhook(rawBody)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const status = payload.status ?? payload.payment_status;
  const orderId = payload.order_id;

  if (!orderId || !['paid', 'paid_over'].includes(status)) {
    return NextResponse.json({ ok: true });
  }

  const service = createServiceClient();

  const { data: topup } = await service
    .from('topup_requests')
    .select('id, user_id, amount, status')
    .eq('id', orderId)
    .single();

  if (!topup || topup.status === 'paid') {
    return NextResponse.json({ ok: true });
  }

  await service.rpc('add_balance', {
    p_user_id: topup.user_id,
    p_amount: topup.amount,
    p_description: 'topup:crypto',
    p_topup_id: topup.id,
  });

  return NextResponse.json({ ok: true });
}