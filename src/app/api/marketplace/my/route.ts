import { mapListingRow, mapPurchaseRow } from '@/lib/marketplace';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  await supabase.rpc('release_marketplace_holds', { p_user_id: user.id });

  const [purchasesRes, listingsRes, salesRes, holdsRes, reviewsRes, disputesRes] =
    await Promise.all([
      supabase
        .from('marketplace_purchases')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('marketplace_listings')
        .select(
          'id, seller_id, title, title_ru, title_en, description, description_ru, description_en, price, currency, category, status, created_at, updated_at, sold_at, buyer_id'
        )
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('marketplace_purchases')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('marketplace_balance_holds')
        .select('id, purchase_id, amount, currency, release_at, released_at')
        .eq('seller_id', user.id)
        .is('released_at', null)
        .order('release_at', { ascending: true }),
      supabase.from('marketplace_reviews').select('purchase_id').eq('reviewer_id', user.id),
      supabase.from('marketplace_disputes').select('purchase_id').eq('buyer_id', user.id),
    ]);

  if (purchasesRes.error || listingsRes.error || salesRes.error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  const reviewSet = new Set((reviewsRes.data ?? []).map((r) => r.purchase_id));
  const disputeSet = new Set((disputesRes.data ?? []).map((d) => d.purchase_id));

  const holdMap = new Map(
    (holdsRes.data ?? []).map((h) => [h.purchase_id, h.release_at as string])
  );

  const enrichPurchase = (row: Record<string, unknown>) =>
    mapPurchaseRow({
      ...row,
      delivery_content:
        row.status === 'open' || row.status === 'completed' || row.status === 'disputed'
          ? row.delivery_content
          : '',
      hold_release_at: holdMap.get(row.id as string) ?? null,
      has_review: reviewSet.has(row.id as string),
      has_dispute: disputeSet.has(row.id as string),
    });

  const purchaseTitles = new Map(
    [...(purchasesRes.data ?? []), ...(salesRes.data ?? [])].map((p) => [p.id, p.title])
  );

  const holds = (holdsRes.data ?? []).map((h) => ({
    id: h.id,
    purchaseId: h.purchase_id,
    amount: Number(h.amount),
    currency: h.currency === 'rub' ? 'rub' : 'usd',
    releaseAt: h.release_at,
    title: purchaseTitles.get(h.purchase_id),
  }));

  return NextResponse.json({
    purchases: (purchasesRes.data ?? []).map((r) => enrichPurchase(r)),
    listings: (listingsRes.data ?? []).map((r) => mapListingRow(r)),
    sales: (salesRes.data ?? []).map((r) => enrichPurchase(r)),
    holds,
    canSell: true,
  });
}