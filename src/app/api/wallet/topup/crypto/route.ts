import { createClient, createServiceClient } from '@/lib/supabase/server';
import { createPlategaTransaction, PLATEGA_PAYMENT_METHOD } from '@/lib/platega';
import type { Currency } from '@/lib/currency';
import { NextResponse } from 'next/server';

const MIN_USDT = 1;
const MAX_USDT = 500;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { amount, locale } = await request.json();
  const parsed = parseFloat(amount);

  if (!parsed || parsed < MIN_USDT || parsed > MAX_USDT) {
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('currency')
    .eq('id', user.id)
    .single();

  const profileCurrency: Currency =
    profile?.currency === 'rub' ? 'rub' : 'usd';

  const service = createServiceClient();

  // amount в topup_requests для crypto = сумма в USDT (для сверки с Platega)
  const { data: topup, error: topupError } = await service
    .from('topup_requests')
    .insert({
      user_id: user.id,
      amount: parsed,
      method: 'crypto',
      status: 'pending',
    })
    .select('id')
    .single();

  if (topupError || !topup) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const lang = locale === 'en' ? 'en' : 'ru';

    const tx = await createPlategaTransaction({
      amount: parsed,
      currency: 'USDT',
      description: `Пополнение ${parsed} USDT`,
      returnUrl: `${siteUrl}/${lang}/account?topup=success`,
      failedUrl: `${siteUrl}/${lang}/account?topup=failed`,
      payload: topup.id,
      paymentMethod: PLATEGA_PAYMENT_METHOD.CRYPTO,
    });

    await service
      .from('topup_requests')
      .update({ external_id: tx.transactionId })
      .eq('id', topup.id);

    return NextResponse.json({
      url: tx.redirect,
      usdt: parsed,
      creditCurrency: profileCurrency,
    });
  } catch (err) {
    console.error('[crypto/topup] Platega error:', err);

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