import { buildPartyPreview, localizedListingText } from '@/lib/marketplace';
import { publicDisplayName } from '@/lib/username';
import { fetchPartyMetaMap } from '@/lib/marketplace-sellers';
import type { Locale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

function parseLocale(value: string | null): Locale {
  return value === 'en' ? 'en' : 'ru';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locale = parseLocale(searchParams.get('locale'));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: threads, error } = await supabase
    .from('marketplace_threads')
    .select('id, listing_id, buyer_id, seller_id, updated_at')
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  const listingIds = [...new Set((threads ?? []).map((t) => t.listing_id))];
  const partyIds = new Set<string>();
  const sellerIds = new Set<string>();
  for (const t of threads ?? []) {
    partyIds.add(t.buyer_id);
    partyIds.add(t.seller_id);
    sellerIds.add(t.seller_id);
  }

  const [listingsRes, partyMeta] = await Promise.all([
    listingIds.length
      ? supabase
          .from('marketplace_listings')
          .select('id, title, title_ru, title_en')
          .in('id', listingIds)
      : Promise.resolve({ data: [], error: null }),
    fetchPartyMetaMap(supabase, [...partyIds], sellerIds),
  ]);

  const listingMap = new Map((listingsRes.data ?? []).map((l) => [l.id, l]));

  const result = await Promise.all(
    (threads ?? []).map(async (t) => {
      const listing = listingMap.get(t.listing_id);
      const { title } = listing
        ? localizedListingText(listing, locale)
        : { title: '—' };

      const isSeller = t.seller_id === user.id;
      const otherId = isSeller ? t.buyer_id : t.seller_id;
      const meta = partyMeta.get(otherId);

      const { data: lastMsg } = await supabase
        .from('marketplace_messages')
        .select('body')
        .eq('thread_id', t.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const otherParty = buildPartyPreview({
        id: otherId,
        username: meta?.username,
        displayName: meta?.displayName,
        avatarUrl: meta?.avatarUrl,
        avgRating: meta?.avgRating,
        reviewCount: meta?.reviewCount,
        isSellerProfile: !isSeller,
      });

      return {
        id: t.id,
        listingId: t.listing_id,
        buyerId: t.buyer_id,
        sellerId: t.seller_id,
        listingTitle: title,
        otherPartyLabel: meta?.displayName ?? publicDisplayName(meta?.username),
        otherParty,
        isSeller,
        updatedAt: t.updated_at,
        lastMessage: lastMsg?.body ?? '',
      };
    })
  );

  return NextResponse.json({ threads: result });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { listingId } = await request.json();
  if (!listingId || typeof listingId !== 'string') {
    return NextResponse.json({ error: 'invalid_listing' }, { status: 400 });
  }

  const { data: listing } = await supabase
    .from('marketplace_listings')
    .select('id, seller_id, status, buyer_id')
    .eq('id', listingId)
    .single();

  if (!listing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (listing.status === 'active') {
    if (listing.seller_id === user.id) {
      return NextResponse.json({ error: 'own_listing' }, { status: 400 });
    }
  } else if (listing.status === 'sold') {
    const isParticipant =
      listing.seller_id === user.id || listing.buyer_id === user.id;
    if (!isParticipant) {
      const { data: purchase } = await supabase
        .from('marketplace_purchases')
        .select('id')
        .eq('listing_id', listingId)
        .eq('buyer_id', user.id)
        .in('status', ['open', 'completed', 'disputed'])
        .maybeSingle();
      if (!purchase) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
    }
  } else {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from('marketplace_threads')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ threadId: existing.id });
  }

  const { data: created, error } = await supabase
    .from('marketplace_threads')
    .insert({
      listing_id: listingId,
      buyer_id: user.id,
      seller_id: listing.seller_id,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: 'server_error', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ threadId: created.id });
}