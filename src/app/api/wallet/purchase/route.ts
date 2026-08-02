import { createClient, isServiceConfigured, createServiceClient } from '@/lib/supabase/server';
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
    .select('currency, account_frozen, balance_frozen')
    .eq('id', user.id)
    .single();

  if (profile?.account_frozen) {
    return NextResponse.json({ error: 'account_frozen' }, { status: 403 });
  }
  if (profile?.balance_frozen) {
    return NextResponse.json({ error: 'balance_frozen' }, { status: 403 });
  }

  const currency = profile?.currency === 'rub' ? 'rub' : 'usd';

  const { data, error } = await supabase.rpc('purchase_plan', {
    p_user_id: user.id,
    p_plan_id: planId,
    p_currency: currency,
    p_reseller_pricing: resellerPricing === true,
  });

  if (error) {
    console.error('[wallet/purchase] purchase_plan rpc failed:', error.message);
    return NextResponse.json({ error: 'server_error', detail: error.message }, { status: 500 });
  }

  if (data?.error) {
    const status = data.error === 'insufficient_balance' ? 402 : 400;
    return NextResponse.json({ error: data.error }, { status });
  }

  // 1+1 Summer Promo: Issue 2nd key for free
  let bonusKey: string | null = (data as { bonus_key?: string })?.bonus_key ?? null;

  if (!bonusKey) {
    try {
      const dbClient = isServiceConfigured() ? createServiceClient() : supabase;

      // Try to pick an available key from license_keys for this plan
      const { data: unusedKeys } = await dbClient
        .from('license_keys')
        .select('id, key')
        .eq('plan_id', planId)
        .eq('used', false)
        .neq('key', data.key)
        .limit(1);

      if (unusedKeys && unusedKeys.length > 0) {
        const bonusItem = unusedKeys[0];
        bonusKey = bonusItem.key;

        await dbClient
          .from('license_keys')
          .update({
            used: true,
            assigned_to: user.id,
            assigned_at: new Date().toISOString(),
          })
          .eq('id', bonusItem.id);
      } else {
        // Fallback generated bonus key for 1+1 promo
        const rand1 = Math.random().toString(36).substring(2, 7).toUpperCase();
        const rand2 = Math.random().toString(36).substring(2, 7).toUpperCase();
        bonusKey = `JULY-1PLUS1-${planId.toUpperCase()}-${rand1}-${rand2}`;
      }

      await dbClient.from('purchases').insert({
        user_id: user.id,
        plan_id: planId,
        license_key: bonusKey,
        amount: 0,
        amount_usd: 0,
      });
    } catch (promoErr) {
      console.error('[wallet/purchase] 1+1 promo error:', promoErr);
    }
  }

  return NextResponse.json({
    success: true,
    key: data.key,
    bonusKey,
    planId: data.plan_id,
    promo1Plus1: true,
  });
}