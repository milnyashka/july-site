import { NextResponse } from 'next/server';
import { createClient, createServiceClient, isServiceConfigured } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const service = isServiceConfigured() ? createServiceClient() : await createClient();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body = await request.json().catch(() => ({}));
  const code = String(body.code ?? '').toUpperCase().trim();
  const targetEmail = String(body.email || user?.email || '').toLowerCase().trim();

  if (!code) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  // Check if code exists
  const { data: promo } = await service
    .from('referral_promocodes')
    .select('code, owner_id')
    .ilike('code', code)
    .maybeSingle();

  if (!promo) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let profileId = user?.id;
  if (!profileId && targetEmail) {
    const { data: p } = await service
      .from('profiles')
      .select('id')
      .eq('email', targetEmail)
      .maybeSingle();
    profileId = p?.id;
  }

  if (!profileId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (promo.owner_id === profileId) {
    return NextResponse.json({ error: 'own_code' }, { status: 400 });
  }

  // Update profile with referral code
  const { error: updateError } = await service
    .from('profiles')
    .update({
      referred_by_code: promo.code,
      referred_by_owner_id: promo.owner_id,
      discounted_purchases_count: 0,
    })
    .eq('id', profileId);

  if (updateError) {
    return NextResponse.json({ error: 'server_error', detail: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    code: promo.code,
    ownerId: promo.owner_id,
  });
}
