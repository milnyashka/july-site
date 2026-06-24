import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { amount } = await request.json();
  const parsed = parseFloat(amount);

  if (!parsed || parsed <= 0) {
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

  return NextResponse.json({ 
    success: true, 
    topupId: topup.id,
    message: 'Заявка на пополнение через CryptoBot создана'
  });
}
