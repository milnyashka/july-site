import { createServiceClient } from '@/lib/supabase/server';
import { creditCryptobotTopup, verifyCryptobotWebhook } from '@/lib/cryptobot';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('crypto-pay-api-signature');

  if (!verifyCryptobotWebhook(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let body: {
    update_type?: string;
    payload?: {
      invoice_id?: number;
      status?: string;
      payload?: string;
    };
  };

  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (body.update_type !== 'invoice_paid' || body.payload?.status !== 'paid') {
    return NextResponse.json({ ok: true });
  }

  const invoice = body.payload;
  const topupId = invoice.payload;
  const invoiceId = invoice.invoice_id != null ? String(invoice.invoice_id) : null;

  const service = createServiceClient();

  let topup = null;

  if (topupId) {
    const { data } = await service
      .from('topup_requests')
      .select('id, user_id, amount, status, method, external_id')
      .eq('id', topupId)
      .maybeSingle();
    topup = data;
  }

  if (!topup && invoiceId) {
    const { data } = await service
      .from('topup_requests')
      .select('id, user_id, amount, status, method, external_id')
      .eq('external_id', invoiceId)
      .maybeSingle();
    topup = data;
  }

  if (!topup || topup.method !== 'cryptobot') {
    return NextResponse.json({ ok: true });
  }

  await creditCryptobotTopup(service, topup, invoice as Parameters<typeof creditCryptobotTopup>[2]);

  return NextResponse.json({ ok: true });
}