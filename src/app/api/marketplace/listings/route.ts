import { NextResponse } from 'next/server';
import {
  MARKETPLACE_CATEGORIES,
  mapListingRow,
  type MarketplaceCategory,
} from '@/lib/marketplace';
import { enrichListingWithSeller, fetchSellerMetaMap } from '@/lib/marketplace-sellers';
import type { Locale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';

function parseLocale(value: string | null): Locale {
  return value === 'en' ? 'en' : 'ru';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const locale = parseLocale(searchParams.get('locale'));

  const supabase = await createClient();

  let query = supabase
    .from('marketplace_listings_public')
    .select(
      'id, seller_id, title, title_ru, title_en, description, description_ru, description_en, price, currency, category, status, created_at, updated_at'
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (category && MARKETPLACE_CATEGORIES.includes(category as MarketplaceCategory)) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  const rows = data ?? [];
  const sellerIds = [...new Set(rows.map((r) => r.seller_id))];
  const sellerMeta =
    sellerIds.length > 0 ? await fetchSellerMetaMap(supabase, sellerIds) : new Map();

  const listings = rows.map((row) =>
    mapListingRow(
      enrichListingWithSeller(row, row.seller_id, sellerMeta.get(row.seller_id)),
      locale
    )
  );

  return NextResponse.json({ listings });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('currency, account_frozen')
    .eq('id', user.id)
    .single();

  if (profile?.account_frozen) {
    return NextResponse.json({ error: 'account_frozen' }, { status: 403 });
  }

  const body = await request.json();
  const titleRu = typeof body.titleRu === 'string' ? body.titleRu.trim() : '';
  const titleEn = typeof body.titleEn === 'string' ? body.titleEn.trim() : '';
  const descriptionRu = typeof body.descriptionRu === 'string' ? body.descriptionRu.trim() : '';
  const descriptionEn = typeof body.descriptionEn === 'string' ? body.descriptionEn.trim() : '';
  const deliveryContent = typeof body.deliveryContent === 'string' ? body.deliveryContent.trim() : '';
  const price = Number(body.price);
  const category = body.category as MarketplaceCategory;
  const publish = body.publish === true;

  if (!titleRu || titleRu.length > 120 || !titleEn || titleEn.length > 120) {
    return NextResponse.json({ error: 'invalid_title' }, { status: 400 });
  }

  if (!deliveryContent || deliveryContent.length > 4000) {
    return NextResponse.json({ error: 'invalid_delivery' }, { status: 400 });
  }

  if (!Number.isFinite(price) || price <= 0 || price > 999999) {
    return NextResponse.json({ error: 'invalid_price' }, { status: 400 });
  }

  const validCategory = MARKETPLACE_CATEGORIES.includes(category) ? category : 'other';
  const currency = profile?.currency === 'rub' ? 'rub' : 'usd';
  const legacyTitle = titleRu || titleEn;

  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({
      seller_id: user.id,
      title: legacyTitle,
      title_ru: titleRu,
      title_en: titleEn,
      description: descriptionRu || descriptionEn,
      description_ru: descriptionRu,
      description_en: descriptionEn,
      delivery_content: deliveryContent,
      price: Math.round(price * 100) / 100,
      currency,
      category: validCategory,
      status: publish ? 'active' : 'draft',
    })
    .select(
      'id, seller_id, title, title_ru, title_en, description, description_ru, description_en, price, currency, category, status, created_at, updated_at'
    )
    .single();

  if (error) {
    return NextResponse.json({ error: 'server_error', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ listing: mapListingRow(data) });
}