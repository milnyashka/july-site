import { NextResponse } from 'next/server';
import { normalizeRoles } from '@/lib/roles';
import { requireOwnerAccess } from '@/lib/staff-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    await requireOwnerAccess();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
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
    .select('id, email, balance, currency, role, roles, account_frozen, balance_frozen, created_at');

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

  return NextResponse.json({
    id: profile.id,
    email: profile.email,
    balance: Number(profile.balance),
    currency: profile.currency === 'rub' ? 'rub' : 'usd',
    role: profile.role,
    roles,
    accountFrozen: Boolean(profile.account_frozen),
    balanceFrozen: Boolean(profile.balance_frozen),
    createdAt: profile.created_at,
  });
}