import { mapPurchaseRow } from '@/lib/marketplace';
import { canModerateMarketplace } from '@/lib/permissions';
import { requireModerator } from '@/lib/staff-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const staff = await requireModerator();
    if (!staff.viaAdminCookie && !canModerateMarketplace(staff.roles)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from('marketplace_purchases')
      .select('*')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }

    const buyerIds = [...new Set((data ?? []).map((r) => r.buyer_id))];
    const sellerIds = [...new Set((data ?? []).map((r) => r.seller_id))];
    const allIds = [...new Set([...buyerIds, ...sellerIds])];

    const emailMap = new Map<string, string>();
    if (allIds.length > 0) {
      const { data: profiles } = await service
        .from('profiles')
        .select('id, email')
        .in('id', allIds);
      for (const p of profiles ?? []) {
        emailMap.set(p.id, p.email);
      }
    }

    const purchases = (data ?? []).map((row) => ({
      ...mapPurchaseRow(row),
      buyerEmail: emailMap.get(row.buyer_id) ?? '',
      sellerEmail: emailMap.get(row.seller_id) ?? '',
    }));

    return NextResponse.json({ purchases });
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}