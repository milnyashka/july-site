import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { createServiceClient, isServiceConfigured } from '@/lib/supabase/server';

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!isServiceConfigured()) {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 });
  }

  const service = createServiceClient();

  const { data: promocodes, error } = await service
    .from('referral_promocodes')
    .select('id, code, owner_id, discount_percent, commission_percent, max_discounted_purchases, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'server_error', detail: error.message }, { status: 500 });
  }

  const result = await Promise.all(
    (promocodes ?? []).map(async (promo) => {
      const { data: owner } = await service
        .from('profiles')
        .select('email')
        .eq('id', promo.owner_id)
        .maybeSingle();

      const { count: referredCount } = await service
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by_owner_id', promo.owner_id);

      const { data: commData } = await service
        .from('transactions')
        .select('amount')
        .eq('user_id', promo.owner_id)
        .eq('type', 'referral_commission');

      const totalEarned = (commData ?? []).reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);

      return {
        id: promo.id,
        code: promo.code,
        ownerId: promo.owner_id,
        ownerEmail: owner?.email ?? 'Unknown',
        discountPercent: promo.discount_percent,
        commissionPercent: promo.commission_percent,
        maxDiscountedPurchases: promo.max_discounted_purchases,
        referredCount: referredCount ?? 0,
        totalEarned,
        createdAt: promo.created_at,
      };
    })
  );

  return NextResponse.json({ promocodes: result });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!isServiceConfigured()) {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 });
  }

  const service = createServiceClient();
  const { code, ownerEmail } = await request.json();

  const normalizedCode = String(code ?? '').toUpperCase().trim();
  const normalizedEmail = String(ownerEmail ?? '').toLowerCase().trim();

  if (!normalizedCode || normalizedCode.length < 3 || normalizedCode.length > 20) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const { data: ownerProfile } = await service
    .from('profiles')
    .select('id, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!ownerProfile) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  // Check if code already exists
  const { data: existingCode } = await service
    .from('referral_promocodes')
    .select('id')
    .ilike('code', normalizedCode)
    .maybeSingle();

  if (existingCode) {
    return NextResponse.json({ error: 'code_exists' }, { status: 409 });
  }

  const { data: newPromo, error: insertError } = await service
    .from('referral_promocodes')
    .insert({
      code: normalizedCode,
      owner_id: ownerProfile.id,
      discount_percent: 15,
      commission_percent: 15,
      max_discounted_purchases: 3,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: 'server_error', detail: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    promocode: {
      id: newPromo.id,
      code: newPromo.code,
      ownerEmail: ownerProfile.email,
      ownerId: ownerProfile.id,
    },
  });
}
