import { mapListingRow, mapReviewRow } from '@/lib/marketplace';
import { fetchPublicProfile } from '@/lib/marketplace-sellers';
import { publicDisplayName } from '@/lib/username';
import type { Locale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

function parseLocale(request: Request): Locale {
  const { searchParams } = new URL(request.url);
  return searchParams.get('locale') === 'en' ? 'en' : 'ru';
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const locale = parseLocale(request);
  const supabase = await createClient();

  const publicProfile = await fetchPublicProfile(supabase, id);
  if (!publicProfile) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: stats } = await supabase
    .from('marketplace_seller_stats')
    .select('completed_sales, avg_rating, review_count')
    .eq('seller_id', id)
    .maybeSingle();

  const [reviewsRes, listingsRes] = await Promise.all([
    supabase
      .from('marketplace_reviews')
      .select('id, purchase_id, reviewer_id, seller_id, rating, comment, created_at')
      .eq('seller_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('marketplace_listings_public')
      .select(
        'id, seller_id, title, title_ru, title_en, description, description_ru, description_en, price, currency, category, status, created_at, updated_at'
      )
      .eq('seller_id', id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  ]);

  const reviews = reviewsRes.data ?? [];
  const purchaseIds = reviews.map((r) => r.purchase_id);
  const dealMap = new Map<
    string,
    {
      deal_title: string;
      deal_price: number;
      deal_currency: 'rub' | 'usd';
      deal_category?: string;
    }
  >();

  if (purchaseIds.length > 0) {
    const { data: purchases } = await supabase
      .from('marketplace_purchases')
      .select('id, title, price, currency, listing_id')
      .in('id', purchaseIds);

    const listingIds = [
      ...new Set((purchases ?? []).map((p) => p.listing_id).filter(Boolean)),
    ] as string[];

    const listingMap = new Map<string, { title: string; category: string }>();

    if (listingIds.length > 0) {
      const { data: listings } = await supabase
        .from('marketplace_listings')
        .select('id, category, title, title_ru, title_en')
        .in('id', listingIds);

      for (const listing of listings ?? []) {
        const title =
          locale === 'en'
            ? String(listing.title_en || listing.title_ru || listing.title)
            : String(listing.title_ru || listing.title_en || listing.title);
        listingMap.set(listing.id, {
          title,
          category: String(listing.category),
        });
      }
    }

    for (const purchase of purchases ?? []) {
      const listing = listingMap.get(purchase.listing_id);
      dealMap.set(purchase.id, {
        deal_title: listing?.title ?? String(purchase.title),
        deal_price: Number(purchase.price),
        deal_currency: purchase.currency === 'rub' ? 'rub' : 'usd',
        deal_category: listing?.category,
      });
    }
  }

  const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
  const reviewerMap = new Map<string, string>();

  if (reviewerIds.length > 0) {
    const { data: reviewers } = await supabase
      .from('profiles_public')
      .select('id, username')
      .in('id', reviewerIds);

    for (const r of reviewers ?? []) {
      reviewerMap.set(r.id, publicDisplayName(r.username ? String(r.username) : null));
    }
  }

  const avgRating = Number(stats?.avg_rating ?? 0);
  const reviewCount = Number(stats?.review_count ?? 0);
  const sellerLabel = publicDisplayName(publicProfile.username);

  return NextResponse.json({
    seller: {
      sellerId: id,
      sellerLabel,
      avatarUrl: publicProfile.avatarUrl,
      lastSeenAt: publicProfile.lastSeenAt,
      completedSales: Number(stats?.completed_sales ?? 0),
      avgRating,
      reviewCount,
      reviews: reviews.map((row) =>
        mapReviewRow({
          ...row,
          reviewer_label: reviewerMap.get(row.reviewer_id),
          ...dealMap.get(row.purchase_id),
        })
      ),
      activeListings: (listingsRes.data ?? []).map((row) =>
        mapListingRow(
          {
            ...row,
            seller_username: publicProfile.username,
            seller_display_name: sellerLabel,
            seller_avatar_url: publicProfile.avatarUrl,
            seller_avg_rating: avgRating,
            seller_review_count: reviewCount,
          },
          locale
        )
      ),
    },
  });
}