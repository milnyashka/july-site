import { createClient } from '@/lib/supabase/server';
import { isValidPlanId } from '@/lib/plans';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { planId, resellerPricing } = await request.json();
  if (!planId || typeof planId !== 'string' || !isValidPlanId(planId)) {
    return NextResponse.json({ error: 'invalid_plan' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('currency')
    .eq('id', user.id)
    .single();

  const currency = profile?.currency === 'rub' ? 'rub' : 'usd';

  const { data, error } = await supabase.rpc('purchase_plan', {
    p_user_id: user.id,
    p_plan_id: planId,
    p_currency: currency,
    p_reseller_pricing: resellerPricing === true,
  });

  if (error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  if (data?.error) {
    const status = data.error === 'insufficient_balance' ? 402 : 400;
    return NextResponse.json({ error: data.error }, { status });
  }

  return NextResponse.json({ success: true, key: data.key, planId: data.plan_id });
}