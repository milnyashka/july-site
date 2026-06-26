import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { resolveAccountRoles } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('roles, role')
    .eq('id', user.id)
    .single();

  const roles = resolveAccountRoles(profile?.roles, profile?.role);

  if (!hasPermission(roles, 'marketplace_buy')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { listingId } = await request.json();

  if (!listingId || typeof listingId !== 'string') {
    return NextResponse.json({ error: 'invalid_listing' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('purchase_marketplace_listing', {
    p_buyer_id: user.id,
    p_listing_id: listingId,
  });

  if (error) {
    return NextResponse.json({ error: 'server_error', detail: error.message }, { status: 500 });
  }

  if (data?.error) {
    const status =
      data.error === 'insufficient_balance' ? 402
      : data.error === 'account_frozen' || data.error === 'balance_frozen' ? 403
      : 400;
    return NextResponse.json({ error: data.error }, { status });
  }

  const status = data.status ?? 'open';

  const { data: listingRow } = await supabase
    .from('marketplace_listings')
    .select('seller_id')
    .eq('id', listingId)
    .single();

  if (listingRow?.seller_id) {
    const { data: existingThread } = await supabase
      .from('marketplace_threads')
      .select('id')
      .eq('listing_id', listingId)
      .eq('buyer_id', user.id)
      .maybeSingle();

    if (!existingThread) {
      await supabase.from('marketplace_threads').insert({
        listing_id: listingId,
        buyer_id: user.id,
        seller_id: listingRow.seller_id,
      });
    }
  }

  return NextResponse.json({
    success: true,
    purchaseId: data.purchase_id,
    status,
    title: data.title,
    price: data.price,
    deliveryContent:
      status === 'open' || status === 'completed' ? data.delivery_content : null,
  });
}