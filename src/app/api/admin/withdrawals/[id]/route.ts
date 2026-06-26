import { NextResponse } from 'next/server';
import { requireOwnerAccess } from '@/lib/staff-auth';
import { createServiceClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireOwnerAccess();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const action = body.action;
  const adminNote = typeof body.adminNote === 'string' ? body.adminNote.trim() : '';

  if (action !== 'completed' && action !== 'rejected') {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 });
  }

  const { data, error } = await service.rpc('process_withdrawal', {
    p_request_id: id,
    p_action: action,
    p_admin_note: adminNote || null,
  });

  if (error) {
    return NextResponse.json({ error: 'server_error', detail: error.message }, { status: 500 });
  }

  if (data?.error) {
    return NextResponse.json({ error: data.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, status: data.status });
}