import { createClient, createServiceClient } from '@/lib/supabase/server';
import { createCryptomusInvoice } from '@/lib/cryptomus';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { amount } = await request.json();
  const parsed = parseFloat(amount);

  const { data: profile } = await supabase
    .from('profiles')
    .select('currency')
    .eq('id', user.id)
    .single();

  const currency = profile?.currency === 'rub' ? 'rub' : 'usd';
  const min = currency === 'rub' ? 50 : 1;
  const max = currency === 'rub' ? 10000 : 500;

  if (!parsed || parsed < min || parsed > max) {
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
  }

  const service = createServiceClient();
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
    const invoice = await createCryptomusInvoice({
      amount: parsed.toFixed(2),
      orderId: topup.id,
      returnUrl: `${siteUrl}/en/account?topup=success`,
      successUrl: `${siteUrl}/en/account?topup=success`,
      callbackUrl: `${siteUrl}/api/webhooks/cryptomus`,
    });

    await service
      .from('topup_requests')
      .update({ external_id: invoice.uuid })
      .eq('id', topup.id);

    return NextResponse.json({ url: invoice.url });
  } catch {
    await service
      .from('topup_requests')
      .update({ status: 'failed' })
      .eq('id', topup.id);

    return NextResponse.json({ error: 'payment_not_configured' }, { status: 503 });
  }
}