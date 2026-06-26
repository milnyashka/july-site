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

  const { purchaseId, targetEmail } = await request.json();
  if (!purchaseId || typeof purchaseId !== 'string') {
    return NextResponse.json({ error: 'invalid_purchase' }, { status: 400 });
  }

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 });
  }

  const { data, error } = await service.rpc('moderator_delete_purchase', {
    p_purchase_id: purchaseId,
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
    action: 'delete_purchase',
    targetEmail: typeof targetEmail === 'string' ? targetEmail : null,
    details: {
      purchaseId,
      licenseKey: data.license_key,
      planId: data.plan_id,
    },
  });

  return NextResponse.json({
    purchaseId: data.purchase_id,
    licenseKey: data.license_key,
    planId: data.plan_id,
  });
}