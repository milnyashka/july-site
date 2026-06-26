import { NextResponse } from 'next/server';
import { validateWithdrawalInput, type WithdrawalMethod } from '@/lib/withdrawals';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const method = body.method as WithdrawalMethod;
  const amount = Number(body.amount);
  const destination = typeof body.destination === 'string' ? body.destination.trim() : '';

  if (method !== 'crypto' && method !== 'card') {
    return NextResponse.json({ error: 'invalid_method' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('balance, currency, account_frozen, balance_frozen')
    .eq('id', user.id)
    .single();

  if (profile?.account_frozen || profile?.balance_frozen) {
    return NextResponse.json({ error: 'balance_frozen' }, { status: 403 });
  }

  const currency = profile?.currency === 'rub' ? 'rub' : 'usd';

  const { data: walletData } = await supabase.rpc('get_wallet_balance', {
    p_user_id: user.id,
  });

  const available = Number(
    (walletData as { available?: number } | null)?.available ??
      profile?.balance ??
      0
  );

  const validationError = validateWithdrawalInput(amount, method, currency, available, destination);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('request_withdrawal', {
    p_user_id: user.id,
    p_method: method,
    p_amount: Math.round(amount * 100) / 100,
    p_destination: destination,
  });

  if (error) {
    return NextResponse.json({ error: 'server_error', detail: error.message }, { status: 500 });
  }

  if (data?.error) {
    const status = data.error === 'insufficient_balance' ? 402 : 400;
    return NextResponse.json({ error: data.error }, { status });
  }

  return NextResponse.json({
    success: true,
    requestId: data.request_id,
    amount: data.amount,
    fee: data.fee,
    netAmount: data.net_amount,
    currency: data.currency,
  });
}