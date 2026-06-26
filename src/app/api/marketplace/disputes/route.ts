import { supportLinks } from '@/lib/support-links';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const purchaseId = typeof body.purchaseId === 'string' ? body.purchaseId : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : '';

  if (!purchaseId || reason.length < 10) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const { data: purchase } = await supabase
    .from('marketplace_purchases')
    .select('id, buyer_id, seller_id, status, title')
    .eq('id', purchaseId)
    .single();

  if (!purchase || purchase.buyer_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (!['open', 'completed', 'disputed'].includes(purchase.status)) {
    return NextResponse.json({ error: 'not_eligible' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('marketplace_disputes')
    .select('id, status')
    .eq('purchase_id', purchaseId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'already_open', disputeId: existing.id }, { status: 400 });
  }

  const { data: dispute, error } = await supabase
    .from('marketplace_disputes')
    .insert({
      purchase_id: purchaseId,
      buyer_id: user.id,
      seller_id: purchase.seller_id,
      reason,
      status: 'open',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  if (purchase.status === 'open' || purchase.status === 'completed') {
    await supabase
      .from('marketplace_purchases')
      .update({ status: 'disputed' })
      .eq('id', purchaseId);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single();

  const ticketText = [
    'Marketplace dispute',
    `Purchase: ${purchaseId}`,
    `Lot: ${purchase.title}`,
    `Buyer: ${profile?.email ?? user.email}`,
    `Reason: ${reason}`,
  ].join('\n');

  const supportUrl = `${supportLinks.telegram}?text=${encodeURIComponent(ticketText)}`;

  return NextResponse.json({
    success: true,
    disputeId: dispute.id,
    supportUrl,
  });
}