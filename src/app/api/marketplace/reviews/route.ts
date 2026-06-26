import { canEditReview, mapReviewRow } from '@/lib/marketplace';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

function parseReviewInput(body: Record<string, unknown>) {
  const purchaseId = typeof body.purchaseId === 'string' ? body.purchaseId : '';
  const rating = Number(body.rating);
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 500) : '';

  if (!purchaseId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: 'invalid_input' as const };
  }

  return { purchaseId, rating, comment };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = parseReviewInput(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { purchaseId, rating, comment } = parsed;

  const { data: purchase } = await supabase
    .from('marketplace_purchases')
    .select('id, buyer_id, seller_id, status')
    .eq('id', purchaseId)
    .single();

  if (!purchase || purchase.buyer_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (purchase.status !== 'completed') {
    return NextResponse.json({ error: 'not_completed' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('marketplace_reviews')
    .select('id')
    .eq('purchase_id', purchaseId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'already_reviewed' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('marketplace_reviews')
    .insert({
      purchase_id: purchaseId,
      reviewer_id: user.id,
      seller_id: purchase.seller_id,
      rating,
      comment,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  return NextResponse.json({ review: mapReviewRow(data) });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = parseReviewInput(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { purchaseId, rating, comment } = parsed;

  const { data: existing } = await supabase
    .from('marketplace_reviews')
    .select('id, reviewer_id, created_at')
    .eq('purchase_id', purchaseId)
    .maybeSingle();

  if (!existing || existing.reviewer_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (!canEditReview(String(existing.created_at))) {
    return NextResponse.json({ error: 'edit_expired' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('marketplace_reviews')
    .update({
      rating,
      comment,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error) {
    if (error.code === '42501' || error.message.includes('policy')) {
      return NextResponse.json({ error: 'edit_expired' }, { status: 400 });
    }
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  return NextResponse.json({ review: mapReviewRow(data) });
}