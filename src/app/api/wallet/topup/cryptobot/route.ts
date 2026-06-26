import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  createCryptobotInvoice,
  cryptobotPayUrl,
  isCryptobotConfigured,
} from '@/lib/cryptobot';
import { NextResponse } from 'next/server';

const MIN_RUB = 25;
const MAX_RUB = 10000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!isCryptobotConfigured()) {
    return NextResponse.json({ error: 'payment_not_configured' }, { status: 503 });
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
      method: 'cryptobot',
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

    const invoice = await createCryptobotInvoice({
      amountRub: parsed,
      description: `July — пополнение ${parsed} ₽`,
      payload: topup.id,
      returnUrl: `${siteUrl}/${lang}/account?topup=success`,
    });

    const payUrl = cryptobotPayUrl(invoice);
    if (!payUrl) {
      throw new Error('NO_PAY_URL');
    }

    await service
      .from('topup_requests')
      .update({ external_id: String(invoice.invoice_id) })
      .eq('id', topup.id);

    return NextResponse.json({
      url: payUrl,
      topupId: topup.id,
      invoiceId: invoice.invoice_id,
    });
  } catch (err) {
    console.error('[cryptobot/topup] error:', err);

    await service
      .from('topup_requests')
      .update({ status: 'failed' })
      .eq('id', topup.id);

    return NextResponse.json({ error: 'payment_failed' }, { status: 503 });
  }
}