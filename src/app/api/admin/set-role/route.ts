import { NextResponse } from 'next/server';
import { canAssignRole } from '@/lib/permissions';
import {
  ACCOUNT_ROLES,
  getPrimaryRole,
  isValidRole,
  normalizeRoles,
  type AccountRole,
} from '@/lib/roles';
import { requireOwnerAccess } from '@/lib/staff-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  let staff;
  try {
    staff = await requireOwnerAccess();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { email } = body;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  let rolesInput: unknown = body.roles;
  if (!Array.isArray(rolesInput) && body.role) {
    rolesInput = [body.role];
  }

  const roles = normalizeRoles(rolesInput);

  for (const r of roles) {
    if (!canAssignRole(staff.roles, r)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (!isValidRole(r)) {
      return NextResponse.json({ error: 'invalid_role', allowed: ACCOUNT_ROLES }, { status: 400 });
    }
  }

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const primaryRole = getPrimaryRole(roles);

  const { data: profile, error: dbError } = await service
    .from('profiles')
    .update({ roles, role: primaryRole })
    .eq('email', normalizedEmail)
    .select('id, email, balance, currency, role, roles, account_frozen, balance_frozen')
    .maybeSingle();

  if (dbError) {
    return NextResponse.json({ error: 'server_error', detail: dbError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: authUser } = await service.auth.admin.getUserById(profile.id);
  const { error: metaError } = await service.auth.admin.updateUserById(profile.id, {
    user_metadata: {
      ...(authUser?.user?.user_metadata ?? {}),
      role: primaryRole,
      roles: profile.roles,
    },
  });

  if (metaError) {
    return NextResponse.json({
      error: 'metadata_update_failed',
      detail: metaError.message,
      email: profile.email,
      roles: normalizeRoles(profile.roles, profile.role),
    }, { status: 500 });
  }

  return NextResponse.json({
    email: profile.email,
    balance: Number(profile.balance),
    currency: profile.currency === 'rub' ? 'rub' : 'usd',
    role: profile.role,
    roles: normalizeRoles(profile.roles, profile.role),
    accountFrozen: Boolean(profile.account_frozen),
    balanceFrozen: Boolean(profile.balance_frozen),
  });
}