import type { Locale } from '@/i18n/config';
import { publicDisplayName } from '@/lib/username';

/** Комиссия площадки с P2P-продаж */
export const MARKETPLACE_COMMISSION = 0.10;

export type MarketplaceListingStatus = 'draft' | 'active' | 'sold' | 'cancelled';

export type MarketplacePurchaseStatus =
  | 'open'
  | 'pending_review'
  | 'completed'
  | 'rejected'
  | 'disputed'
  | 'refunded';

export type MarketplaceDisputeStatus = 'open' | 'resolved' | 'rejected';

export type MarketplaceCategory = 'accounts' | 'keys' | 'tools' | 'other';

export type MarketplaceListing = {
  id: string;
  sellerId: string;
  title: string;
  titleRu: string;
  titleEn: string;
  description: string;
  descriptionRu: string;
  descriptionEn: string;
  price: number;
  currency: 'rub' | 'usd';
  category: MarketplaceCategory;
  status: MarketplaceListingStatus;
  createdAt: string;
  updatedAt?: string;
  soldAt?: string | null;
  buyerId?: string | null;
  deliveryContent?: string;
  sellerLabel?: string;
  sellerAvatarUrl?: string | null;
  sellerAvgRating?: number;
  sellerReviewCount?: number;
};

export type MarketplacePartyPreview = {
  id: string;
  label: string;
  avatarUrl: string | null;
  avgRating: number;
  reviewCount: number;
  isSellerProfile: boolean;
};

export type MarketplacePurchase = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  title: string;
  price: number;
  currency: 'rub' | 'usd';
  buyerPaid: number | null;
  buyerCurrency: 'rub' | 'usd' | null;
  fee: number;
  sellerPayout: number;
  deliveryContent: string;
  status: MarketplacePurchaseStatus;
  reviewedAt?: string | null;
  rejectReason?: string | null;
  createdAt: string;
  holdReleaseAt?: string | null;
  hasReview?: boolean;
  hasDispute?: boolean;
};

export type MarketplaceReview = {
  id: string;
  purchaseId: string;
  reviewerId: string;
  sellerId: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewerLabel?: string;
};

export type MarketplaceSellerProfile = {
  sellerId: string;
  sellerLabel: string;
  avatarUrl: string | null;
  lastSeenAt: string | null;
  completedSales: number;
  avgRating: number;
  reviewCount: number;
  reviews: MarketplaceReview[];
  activeListings: MarketplaceListing[];
};

export type MarketplaceBalanceHold = {
  id: string;
  purchaseId: string;
  amount: number;
  currency: 'rub' | 'usd';
  releaseAt: string;
  title?: string;
};

export type MarketplaceThread = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  listingTitle: string;
  otherPartyLabel: string;
  otherParty: MarketplacePartyPreview;
  isSeller: boolean;
  updatedAt: string;
  lastMessage?: string;
};

export type MarketplaceMessage = {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
  isMine: boolean;
};

export const MARKETPLACE_CATEGORIES: readonly MarketplaceCategory[] = [
  'accounts',
  'keys',
  'tools',
  'other',
] as const;

export function calcMarketplaceFee(price: number): number {
  return Math.round(price * MARKETPLACE_COMMISSION * 100) / 100;
}

export function calcSellerPayout(price: number): number {
  return Math.round((price - calcMarketplaceFee(price)) * 100) / 100;
}

export function initialsFromEmail(email?: string): string {
  if (!email) return '?';
  const local = email.split('@')[0] ?? '';
  return (local.slice(0, 2) || email.slice(0, 2)).toUpperCase();
}

export function buildPartyPreview(params: {
  id: string;
  email?: string;
  username?: string | null;
  displayName?: string;
  avatarUrl?: string | null;
  avgRating?: number;
  reviewCount?: number;
  isSellerProfile?: boolean;
}): MarketplacePartyPreview {
  return {
    id: params.id,
    label: params.displayName ?? publicDisplayName(params.username),
    avatarUrl: params.avatarUrl ?? null,
    avgRating: Number(params.avgRating ?? 0),
    reviewCount: Number(params.reviewCount ?? 0),
    isSellerProfile: params.isSellerProfile ?? false,
  };
}

export function maskSellerEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 1) return 'seller';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function localizedListingText(
  row: Record<string, unknown>,
  locale: Locale
): { title: string; description: string } {
  const titleRu = String(row.title_ru ?? row.title ?? '');
  const titleEn = String(row.title_en ?? row.title ?? '');
  const descriptionRu = String(row.description_ru ?? row.description ?? '');
  const descriptionEn = String(row.description_en ?? row.description ?? '');

  if (locale === 'ru') {
    return {
      title: titleRu || titleEn,
      description: descriptionRu || descriptionEn,
    };
  }
  return {
    title: titleEn || titleRu,
    description: descriptionEn || descriptionRu,
  };
}

export function mapListingRow(
  row: Record<string, unknown>,
  locale: Locale = 'ru'
): MarketplaceListing {
  const { title, description } = localizedListingText(row, locale);

  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    title,
    titleRu: String(row.title_ru ?? row.title ?? ''),
    titleEn: String(row.title_en ?? row.title ?? ''),
    description,
    descriptionRu: String(row.description_ru ?? row.description ?? ''),
    descriptionEn: String(row.description_en ?? row.description ?? ''),
    price: Number(row.price),
    currency: row.currency === 'rub' ? 'rub' : 'usd',
    category: (row.category as MarketplaceCategory) ?? 'other',
    status: row.status as MarketplaceListingStatus,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    soldAt: row.sold_at ? String(row.sold_at) : null,
    buyerId: row.buyer_id ? String(row.buyer_id) : null,
    deliveryContent: row.delivery_content ? String(row.delivery_content) : undefined,
    sellerLabel: row.seller_display_name
      ? String(row.seller_display_name)
      : row.seller_username
        ? String(row.seller_username)
        : 'User',
    sellerAvatarUrl: row.seller_avatar_url ? String(row.seller_avatar_url) : null,
    sellerAvgRating: row.seller_avg_rating != null ? Number(row.seller_avg_rating) : 0,
    sellerReviewCount: row.seller_review_count != null ? Number(row.seller_review_count) : 0,
  };
}

export function mapPurchaseRow(row: Record<string, unknown>): MarketplacePurchase {
  return {
    id: String(row.id),
    listingId: String(row.listing_id),
    buyerId: String(row.buyer_id),
    sellerId: String(row.seller_id),
    title: String(row.title),
    price: Number(row.price),
    currency: row.currency === 'rub' ? 'rub' : 'usd',
    buyerPaid: row.buyer_paid != null ? Number(row.buyer_paid) : null,
    buyerCurrency: row.buyer_currency === 'rub' ? 'rub' : row.buyer_currency === 'usd' ? 'usd' : null,
    fee: Number(row.fee),
    sellerPayout: Number(row.seller_payout),
    deliveryContent: row.delivery_content ? String(row.delivery_content) : '',
    status: (row.status as MarketplacePurchaseStatus) ?? 'completed',
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    rejectReason: row.reject_reason ? String(row.reject_reason) : null,
    createdAt: String(row.created_at),
    holdReleaseAt: row.hold_release_at ? String(row.hold_release_at) : null,
    hasReview: Boolean(row.has_review),
    hasDispute: Boolean(row.has_dispute),
  };
}

export function mapReviewRow(row: Record<string, unknown>): MarketplaceReview {
  return {
    id: String(row.id),
    purchaseId: String(row.purchase_id),
    reviewerId: String(row.reviewer_id),
    sellerId: String(row.seller_id),
    rating: Number(row.rating),
    comment: String(row.comment ?? ''),
    createdAt: String(row.created_at),
    reviewerLabel: row.reviewer_label ? String(row.reviewer_label) : undefined,
  };
}

export function purchaseStatusLabel(
  status: MarketplacePurchaseStatus,
  labels: Record<string, string>
): string {
  return labels[status] ?? status;
}

export function buyerChargeForListing(
  listingPrice: number,
  listingCurrency: 'rub' | 'usd',
  buyerCurrency: 'rub' | 'usd'
): number {
  if (listingCurrency === buyerCurrency) return listingPrice;
  if (listingCurrency === 'usd' && buyerCurrency === 'rub') {
    return Math.round(listingPrice * 79 * 100) / 100;
  }
  return Math.round((listingPrice / 79) * 100) / 100;
}