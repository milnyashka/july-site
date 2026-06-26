import { NextResponse } from 'next/server';
import { mapListingRow } from '@/lib/marketplace';
import { createClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from('marketplace_listings')
    .select('id, seller_id, status')
    .eq('id', id)
    .single();

  if (!existing || existing.seller_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (existing.status === 'sold') {
    return NextResponse.json({ error: 'already_sold' }, { status: 400 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status === 'active' || body.status === 'cancelled' || body.status === 'draft') {
    updates.status = body.status;
  }

  if (typeof body.titleRu === 'string' && body.titleRu.trim()) {
    updates.title_ru = body.titleRu.trim().slice(0, 120);
    updates.title = updates.title_ru;
  }

  if (typeof body.titleEn === 'string' && body.titleEn.trim()) {
    updates.title_en = body.titleEn.trim().slice(0, 120);
  }

  if (typeof body.descriptionRu === 'string') {
    updates.description_ru = body.descriptionRu.trim().slice(0, 2000);
    updates.description = updates.description_ru;
  }

  if (typeof body.descriptionEn === 'string') {
    updates.description_en = body.descriptionEn.trim().slice(0, 2000);
  }

  if (typeof body.deliveryContent === 'string' && body.deliveryContent.trim()) {
    updates.delivery_content = body.deliveryContent.trim().slice(0, 4000);
  }

  const { data, error } = await supabase
    .from('marketplace_listings')
    .update(updates)
    .eq('id', id)
    .eq('seller_id', user.id)
    .select(
      'id, seller_id, title, title_ru, title_en, description, description_ru, description_en, price, currency, category, status, created_at, updated_at, sold_at, buyer_id'
    )
    .single();

  if (error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  return NextResponse.json({ listing: mapListingRow(data) });
}