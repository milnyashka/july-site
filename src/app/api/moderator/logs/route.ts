import { NextResponse } from 'next/server';
import { canViewAllModeratorLogs, canViewModeratorLogs } from '@/lib/permissions';
import { mapLogRow } from '@/lib/moderator-log';
import { requireStaff } from '@/lib/staff-auth';
import { createServiceClient } from '@/lib/supabase/server';

const STAFF_LOG_ROLES = ['moderator', 'moderator_senior', 'owner'];

export async function GET(request: Request) {
  let staff;
  try {
    staff = await requireStaff();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!canViewModeratorLogs(staff.roles, staff.viaAdminCookie)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 });
  }

  let query = service
    .from('moderator_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const viewAll = canViewAllModeratorLogs(staff.roles, staff.viaAdminCookie);

  if (!viewAll) {
    query = query.overlaps('actor_roles', ['moderator', 'moderator_senior']);
  } else {
    query = query.overlaps('actor_roles', STAFF_LOG_ROLES);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: 'server_error', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({
    logs: (data ?? []).map((row) => mapLogRow(row as Record<string, unknown>)),
    total: count ?? 0,
    viewAll,
  });
}