import { NextResponse } from 'next/server';
import { mapWithdrawalRow } from '@/lib/withdrawals';
import { requireOwnerAccess } from '@/lib/staff-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    await requireOwnerAccess();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'pending';

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 });
  }

  let query = service
    .from('withdrawal_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'server_error', detail: error.message }, { status: 500 });
  }

  const userIds = [...new Set((data ?? []).map((r) => r.user_id))];
  const emailMap = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles } = await service
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    for (const p of profiles ?? []) {
      emailMap.set(p.id, p.email);
    }
  }

  const requests = (data ?? []).map((row) =>
    mapWithdrawalRow({ ...row, user_email: emailMap.get(row.user_id) })
  );

  return NextResponse.json({ requests });
}