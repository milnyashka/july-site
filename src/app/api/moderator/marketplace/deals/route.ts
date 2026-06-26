import { mapPurchaseRow } from '@/lib/marketplace';
import { canModerateMarketplace } from '@/lib/permissions';
import { requireModerator } from '@/lib/staff-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type DealFilter = 'all' | 'open' | 'completed' | 'needs_help';

export async function GET(request: Request) {
  try {
    const staff = await requireModerator();
    if (!staff.viaAdminCookie && !canModerateMarketplace(staff.roles)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filter = (searchParams.get('filter') ?? 'all') as DealFilter;

    const service = createServiceClient();

    let query = service.from('marketplace_purchases').select('*').order('created_at', { ascending: false });

    if (filter === 'open') {
      query = query.eq('status', 'open');
    } else if (filter === 'completed') {
      query = query.eq('status', 'completed');
    } else if (filter === 'needs_help') {
      query = query.eq('status', 'disputed');
    }

    const { data, error } = await query.limit(100);

    if (error) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }

    let rows = data ?? [];

    if (filter === 'needs_help') {
      const purchaseIds = rows.map((r) => r.id);
      const { data: disputes } = purchaseIds.length
        ? await service
            .from('marketplace_disputes')
            .select('purchase_id, reason, status, created_at')
            .in('purchase_id', purchaseIds)
            .eq('status', 'open')
        : { data: [] };

      const disputeMap = new Map((disputes ?? []).map((d) => [d.purchase_id, d]));
      rows = rows.filter((r) => disputeMap.has(r.id));
    }

    const allIds = [
      ...new Set(rows.flatMap((r) => [r.buyer_id, r.seller_id])),
    ];
    const emailMap = new Map<string, string>();
    if (allIds.length > 0) {
      const { data: profiles } = await service.from('profiles').select('id, email').in('id', allIds);
      for (const p of profiles ?? []) {
        emailMap.set(p.id, p.email);
      }
    }

    const disputeIds = rows.map((r) => r.id);
    const { data: allDisputes } = disputeIds.length
      ? await service
          .from('marketplace_disputes')
          .select('purchase_id, reason, status')
          .in('purchase_id', disputeIds)
      : { data: [] };
    const disputeByPurchase = new Map((allDisputes ?? []).map((d) => [d.purchase_id, d]));

    const purchases = rows.map((row) => ({
      ...mapPurchaseRow(row),
      buyerEmail: emailMap.get(row.buyer_id) ?? '',
      sellerEmail: emailMap.get(row.seller_id) ?? '',
      disputeReason: disputeByPurchase.get(row.id)?.reason ?? null,
      disputeStatus: disputeByPurchase.get(row.id)?.status ?? null,
    }));

    return NextResponse.json({ purchases, filter });
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}