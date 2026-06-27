import { canModerateMarketplace } from '@/lib/permissions';
import { requireModerator } from '@/lib/staff-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const staff = await requireModerator();
    if (!staff.viaAdminCookie && !canModerateMarketplace(staff.roles)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const purchaseId = typeof body.purchaseId === 'string' ? body.purchaseId : '';
    const actionRaw = body.action;
    const action = actionRaw === 'reject' || actionRaw === 'refund' ? actionRaw : 'approve';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!purchaseId) {
      return NextResponse.json({ error: 'invalid_purchase' }, { status: 400 });
    }

    const service = createServiceClient();

    let data: any;
    let error: any;

    if (action === 'refund') {
      const res = await service.rpc('refund_marketplace_purchase', {
        p_purchase_id: purchaseId,
        p_actor_id: staff.userId,
        p_reason: reason || null,
      });
      data = res.data;
      error = res.error;
    } else {
      const rpcName =
        action === 'reject' ? 'reject_marketplace_purchase' : 'approve_marketplace_purchase';
      const res = await service.rpc(rpcName, {
        p_purchase_id: purchaseId,
        p_reviewer_id: staff.userId,
        ...(action === 'reject' ? { p_reason: reason || null } : {}),
      });
      data = res.data;
      error = res.error;
    }

    if (error) {
      return NextResponse.json({ error: 'server_error', detail: error.message }, { status: 500 });
    }

    if (data?.error) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}