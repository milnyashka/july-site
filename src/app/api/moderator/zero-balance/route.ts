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

  const { email } = await request.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const { data, error } = await service.rpc('moderator_zero_balance', {
    p_target_email: normalizedEmail,
  });

  if (error) {
    return NextResponse.json({ error: 'server_error', detail: error.message }, { status: 500 });
  }

  if (data?.error) {
    const status =
      data.error === 'not_found' ? 404 : data.error === 'protected_role' ? 403 : 400;
    return NextResponse.json({ error: data.error }, { status });
  }

  await writeModeratorLog(service, {
    actorId: staff.userId,
    actorEmail: staff.email ?? 'unknown',
    actorRoles: staff.roles,
    action: 'zero_balance',
    targetEmail: normalizedEmail,
    details: { zeroed: Number(data.zeroed) },
  });

  return NextResponse.json({
    email: data.email,
    balance: Number(data.balance),
    currency: data.currency === 'rub' ? 'rub' : 'usd',
    zeroed: Number(data.zeroed),
  });
}