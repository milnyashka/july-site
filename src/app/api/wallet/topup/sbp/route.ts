import { createClient, createServiceClient } from '@/lib/supabase/server';
import { createPlategaTransaction, PLATEGA_PAYMENT_METHOD } from '@/lib/platega';
import { NextResponse } from 'next/server';

const MIN_RUB = 10;
const MAX_RUB = 10000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { amount, locale } = await request.json();
  const parsed = parseFloat(amount);

  if (!parsed || parsed < MIN_RUB || parsed > MAX_RUB) {
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: topup, error } = await service
    .from('topup_requests')
    .insert({
      user_id: user.id,
      amount: parsed,
      method: 'sbp',
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !topup) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const lang = locale === 'en' ? 'en' : 'ru';

    const tx = await createPlategaTransaction({
      amount: parsed,
      currency: 'RUB',
      description: `Пополнение баланса ${parsed} ₽`,
      returnUrl: `${siteUrl}/${lang}/account?topup=success`,
      failedUrl: `${siteUrl}/${lang}/account?topup=failed`,
      payload: topup.id,
      paymentMethod: PLATEGA_PAYMENT_METHOD.SBP_QR,
    });

    await service
      .from('topup_requests')
      .update({ external_id: tx.transactionId })
      .eq('id', topup.id);

    return NextResponse.json({ url: tx.redirect, topupId: topup.id });
  } catch (err) {
    console.error('[sbp/topup] Platega error:', err);

    await service
      .from('topup_requests')
      .update({ status: 'failed' })
      .eq('id', topup.id);

    const missingEnv =
      !process.env.PLATEGA_MERCHANT_ID || !process.env.PLATEGA_API_KEY;

    return NextResponse.json(
      { error: missingEnv ? 'payment_not_configured' : 'payment_failed' },
      { status: 503 }
    );
  }
}