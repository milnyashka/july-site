import { NextResponse } from 'next/server';
import { writeModeratorLog } from '@/lib/moderator-log';
import { requireModerator } from '@/lib/staff-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  let staff;
  try {
    staff = await requireModerator();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unauthorized';
    return NextResponse.json({ error: msg }, { status: msg === 'forbidden' ? 403 : 401 });
  }

  const body = await request.json();
  const email = body?.email;
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const flags: Record<string, boolean | null> = {
    p_account_frozen: typeof body.accountFrozen === 'boolean' ? body.accountFrozen : null,
    p_balance_frozen: typeof body.balanceFrozen === 'boolean' ? body.balanceFrozen : null,
  };

  if (flags.p_account_frozen === null && flags.p_balance_frozen === null) {
    return NextResponse.json({ error: 'no_flags' }, { status: 400 });
  }

  const freezeReason =
    typeof body.freezeReason === 'string' ? body.freezeReason.trim() : null;

  if (flags.p_account_frozen === true && !freezeReason) {
    return NextResponse.json({ error: 'reason_required' }, { status: 400 });
  }

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const { data, error } = await service.rpc('moderate_user', {
    p_target_email: normalizedEmail,
    p_freeze_reason: freezeReason,
    ...flags,
  });

  if (error) {
    return NextResponse.json({ error: 'server_error', detail: error.message }, { status: 500 });
  }

  if (data?.error) {
    const status =
      data.error === 'not_found' ? 404 : data.error === 'protected_role' ? 403 : 400;
    return NextResponse.json({ error: data.error }, { status });
  }

  const logs: Promise<void>[] = [];

  if (flags.p_account_frozen !== null) {
    logs.push(
      writeModeratorLog(service, {
        actorId: staff.userId,
        actorEmail: staff.email ?? 'unknown',
        actorRoles: staff.roles,
        action: flags.p_account_frozen ? 'freeze_account' : 'unfreeze_account',
        targetEmail: normalizedEmail,
        details: {
          accountFrozen: flags.p_account_frozen,
          reason: flags.p_account_frozen ? freezeReason : null,
        },
      })
    );
  }

  if (flags.p_balance_frozen !== null) {
    logs.push(
      writeModeratorLog(service, {
        actorId: staff.userId,
        actorEmail: staff.email ?? 'unknown',
        actorRoles: staff.roles,
        action: flags.p_balance_frozen ? 'freeze_balance' : 'unfreeze_balance',
        targetEmail: normalizedEmail,
        details: { balanceFrozen: flags.p_balance_frozen },
      })
    );
  }

  await Promise.all(logs);

  return NextResponse.json({
    email: data.email,
    role: data.role,
    roles: data.roles,
    balance: Number(data.balance),
    currency: data.currency === 'rub' ? 'rub' : 'usd',
    accountFrozen: data.account_frozen,
    balanceFrozen: data.balance_frozen,
    accountFreezeReason: data.account_freeze_reason ?? null,
  });
}