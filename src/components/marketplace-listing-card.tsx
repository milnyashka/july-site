'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { MarketplaceListing } from '@/lib/marketplace';
import { formatMoney } from '@/lib/currency';
import { useI18n } from '@/i18n/I18nProvider';
import { SellerProfileChip } from '@/components/seller-profile-chip';
import { SellerRatingBadge } from '@/components/seller-rating-badge';
import { MessageCircle, ShoppingBag } from 'lucide-react';

type Props = {
  listing: MarketplaceListing;
  onBuy: (listing: MarketplaceListing) => void;
  onChat: (listing: MarketplaceListing) => void;
  isOwnListing?: boolean;
};

export function MarketplaceListingCard({ listing, onBuy, onChat, isOwnListing }: Props) {
  const { dict } = useI18n();
  const m = dict.marketplace;

  return (
    <Card className="flex flex-col h-full hover:border-primary/40 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight">{listing.title}</CardTitle>
          <Badge variant="outline" className="shrink-0 text-xs">
            {(m.categories as Record<string, string>)[listing.category]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {listing.description || m.noDescription}
        </p>
        {!isOwnListing && listing.sellerLabel && (
          <SellerProfileChip
            size="sm"
            party={{
              id: listing.sellerId,
              label: listing.sellerLabel,
              avatarUrl: listing.sellerAvatarUrl ?? null,
              avgRating: listing.sellerAvgRating ?? 0,
              reviewCount: listing.sellerReviewCount ?? 0,
              isSellerProfile: true,
            }}
          />
        )}
        {isOwnListing && listing.sellerLabel && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{m.seller}: {listing.sellerLabel}</span>
            <SellerRatingBadge
              rating={listing.sellerAvgRating ?? 0}
              reviewCount={listing.sellerReviewCount ?? 0}
              noReviewsLabel={m.noReviewsShort}
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 pt-0">
        <div className="flex w-full items-center justify-between gap-3">
          <div>
            <span className="text-xl font-bold text-primary block">
              {formatMoney(listing.price, listing.currency)}
            </span>
            <span className="text-xs text-muted-foreground">{m.price}</span>
          </div>
          {!isOwnListing && (
            <Button size="sm" onClick={() => onBuy(listing)}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              {m.buy}
            </Button>
          )}
        </div>
        {!isOwnListing && (
          <Button size="sm" variant="outline" className="w-full" onClick={() => onChat(listing)}>
            <MessageCircle className="mr-2 h-4 w-4" />
            {m.chatWithSeller}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}