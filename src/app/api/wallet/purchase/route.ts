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

  // Process Referral Promo Code Commission (15% to promo code owner)
  try {
    const dbClient = isServiceConfigured() ? createServiceClient() : supabase;

    const { data: userProfile } = await dbClient
      .from('profiles')
      .select('referred_by_owner_id, discounted_purchases_count')
      .eq('id', user.id)
      .maybeSingle();

    if (userProfile?.referred_by_owner_id) {
      const ownerId = userProfile.referred_by_owner_id;
      const count = Number(userProfile.discounted_purchases_count || 0);

      // Increment discounted_purchases_count if under 3
      if (count < 3) {
        await dbClient
          .from('profiles')
          .update({ discounted_purchases_count: count + 1 })
          .eq('id', user.id);
      }

      // Fetch amount paid for latest purchase
      const { data: latestPurchase } = await dbClient
        .from('purchases')
        .select('amount, currency')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const paidAmount = Number(latestPurchase?.amount || 0);
      if (paidAmount > 0) {
        const commission = Math.round(paidAmount * 0.15 * 100) / 100;
        if (commission > 0) {
          // Get owner balance & add commission
          const { data: ownerProfile } = await dbClient
            .from('profiles')
            .select('balance')
            .eq('id', ownerId)
            .maybeSingle();

          if (ownerProfile) {
            const newOwnerBal = Math.round((Number(ownerProfile.balance || 0) + commission) * 100) / 100;
            await dbClient
              .from('profiles')
              .update({ balance: newOwnerBal })
              .eq('id', ownerId);

            await dbClient.from('transactions').insert({
              user_id: ownerId,
              type: 'referral_commission',
              amount: commission,
              description: `Реферальные 15% с покупки пользователя ${user.id.slice(0, 8)}`,
            });
          }
        }
      }
    }
  } catch (refErr) {
    console.error('[wallet/purchase] Referral commission error:', refErr);
  }

  return NextResponse.json({
    success: true,
    key: data.key,
    planId: data.plan_id,
  });
}
