import { createClient } from '@/lib/supabase/server';
import { getSellixCheckoutUrl } from '@/lib/sellix';
import { topupAmountsRub, topupAmountsUsd } from '@/lib/plans';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { amount } = await request.json();
  const parsed = Number(amount);

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, currency')
    .eq('id', user.id)
    .single();

  if (!profile?.email) {
    return NextResponse.json({ error: 'no_profile' }, { status: 400 });
  }

  const allowed =
    profile.currency === 'rub'
      ? (topupAmountsRub as readonly number[]).includes(parsed)
      : (topupAmountsUsd as readonly number[]).includes(parsed);

  if (!allowed) {
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
  }

  const url = getSellixCheckoutUrl(parsed, profile.email);

  if (!url) {
    return NextResponse.json({ error: 'payment_not_configured' }, { status: 503 });
  }

  return NextResponse.json({ url });
}