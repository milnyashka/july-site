import { NextResponse } from 'next/server';
import { canModerateTarget } from '@/lib/permissions';
import { normalizeRoles } from '@/lib/roles';
import { requireModerator } from '@/lib/staff-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    await requireModerator();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unauthorized';
    return NextResponse.json({ error: msg }, { status: msg === 'forbidden' ? 403 : 401 });
  }

  const body = await request.json();
  const identifier = String(body.identifier ?? body.email ?? '').trim();
  if (!identifier) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 });
  }

  const isEmail = identifier.includes('@');
  const normalized = isEmail ? identifier.toLowerCase() : identifier;

  let profileQuery = service
    .from('profiles')
    .select('id, email, balance, currency, role, roles, account_frozen, balance_frozen, account_freeze_reason, created_at');

  if (isEmail) {
    profileQuery = profileQuery.eq('email', normalized);
  } else {
    profileQuery = profileQuery.ilike('username', normalized);
  }

  const { data: profile, error: dbError } = await profileQuery.maybeSingle();

  if (dbError) {
    return NextResponse.json({ error: 'server_error', detail: dbError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const roles = normalizeRoles(profile.roles, profile.role);
  if (!canModerateTarget(roles)) {
    return NextResponse.json({ error: 'protected_role' }, { status: 403 });
  }

  const { data: purchases, error: purchasesError } = await service
    .from('purchases')
    .select('id, license_key, plan_id, amount, created_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });

  if (purchasesError) {
    return NextResponse.json({ error: 'server_error', detail: purchasesError.message }, { status: 500 });
  }

  return NextResponse.json({
    id: profile.id,
    email: profile.email,
    balance: Number(profile.balance),
    currency: profile.currency === 'rub' ? 'rub' : 'usd',
    role: profile.role,
    roles,
    accountFrozen: Boolean(profile.account_frozen),
    balanceFrozen: Boolean(profile.balance_frozen),
    accountFreezeReason: profile.account_freeze_reason ?? null,
    createdAt: profile.created_at,
    purchases: (purchases ?? []).map((p) => ({
      id: p.id,
      licenseKey: p.license_key,
      planId: p.plan_id,
      amount: Number(p.amount),
      createdAt: p.created_at,
    })),
  });
}