import type { SupabaseClient } from '@supabase/supabase-js';
import { publicDisplayName } from '@/lib/username';

export type SellerMeta = {
  email: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  avgRating: number;
  reviewCount: number;
};

export async function fetchSellerMetaMap(
  supabase: SupabaseClient,
  sellerIds: string[]
): Promise<Map<string, SellerMeta>> {
  const map = new Map<string, SellerMeta>();
  if (sellerIds.length === 0) return map;

  const [publicRes, statsRes] = await Promise.all([
    supabase.from('profiles_public').select('id, username, avatar_url').in('id', sellerIds),
    supabase
      .from('marketplace_seller_stats')
      .select('seller_id, avg_rating, review_count')
      .in('seller_id', sellerIds),
  ]);

  const statsMap = new Map(
    (statsRes.data ?? []).map((s) => [
      s.seller_id,
      { avgRating: Number(s.avg_rating ?? 0), reviewCount: Number(s.review_count ?? 0) },
    ])
  );

  for (const p of publicRes.data ?? []) {
    const st = statsMap.get(p.id);
    const username = p.username ? String(p.username) : null;
    map.set(p.id, {
      email: '',
      username,
      displayName: publicDisplayName(username),
      avatarUrl: p.avatar_url ?? null,
      avgRating: st?.avgRating ?? 0,
      reviewCount: st?.reviewCount ?? 0,
    });
  }

  return map;
}

export function enrichListingWithSeller(
  row: Record<string, unknown>,
  sellerId: string,
  meta: SellerMeta | undefined
): Record<string, unknown> {
  if (!meta) return row;
  return {
    ...row,
    seller_username: meta.username,
    seller_display_name: meta.displayName,
    seller_avatar_url: meta.avatarUrl,
    seller_avg_rating: meta.avgRating,
    seller_review_count: meta.reviewCount,
  };
}

export async function fetchPartyMetaMap(
  supabase: SupabaseClient,
  partyIds: string[],
  sellerIds: Set<string>
): Promise<Map<string, SellerMeta>> {
  const map = await fetchSellerMetaMap(supabase, partyIds);

  for (const id of partyIds) {
    if (!map.has(id)) continue;
    if (!sellerIds.has(id)) {
      const entry = map.get(id)!;
      map.set(id, { ...entry, avgRating: 0, reviewCount: 0 });
    }
  }

  return map;
}

export async function fetchPublicProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{ username: string | null; avatarUrl: string | null; lastSeenAt: string | null } | null> {
  const { data } = await supabase
    .from('profiles_public')
    .select('username, avatar_url, last_seen_at')
    .eq('id', userId)
    .maybeSingle();

  if (!data) return null;
  return {
    username: data.username ? String(data.username) : null,
    avatarUrl: data.avatar_url ? String(data.avatar_url) : null,
    lastSeenAt: data.last_seen_at ? String(data.last_seen_at) : null,
  };
}