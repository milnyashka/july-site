'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SellerRatingBadge } from '@/components/seller-rating-badge';
import type { MarketplaceListing, MarketplaceSellerProfile } from '@/lib/marketplace';
import { formatMoney } from '@/lib/currency';
import { formatLastSeen } from '@/lib/last-seen';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';

export default function SellerProfilePage() {
  const { locale, dict } = useI18n();
  const m = dict.marketplace;
  const params = useParams();
  const sellerId = String(params.id ?? '');

  const [seller, setSeller] = useState<MarketplaceSellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!sellerId) return;
    fetch(`/api/marketplace/sellers/${sellerId}?locale=${locale}`)
      .then((r) => {
        if (!r.ok) throw new Error('not_found');
        return r.json();
      })
      .then((data) => setSeller(data.seller))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sellerId, locale]);

  if (loading) {
    return (
      <div className="container py-20 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="container py-20 text-center text-muted-foreground">
        <p>{m.sellerNotFound}</p>
        <Link
          href={localizedPath(locale, '/marketplace')}
          className="text-primary hover:underline mt-4 inline-block"
        >
          {m.backToMarket}
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-12 md:py-16 max-w-2xl">
      <Link
        href={localizedPath(locale, '/marketplace')}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {m.backToMarket}
      </Link>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={seller.avatarUrl ?? undefined} alt={seller.sellerLabel} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {seller.sellerLabel.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{m.sellerProfile}</CardTitle>
              <p className="text-muted-foreground mt-1">{seller.sellerLabel}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {m.lastSeen.label}:{' '}
                {formatLastSeen(seller.lastSeenAt, locale, m.lastSeen)}
              </p>
              <div className="mt-2">
                <SellerRatingBadge
                  rating={seller.avgRating}
                  reviewCount={seller.reviewCount}
                  noReviewsLabel={m.noReviewsShort}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Badge variant="secondary">
            {m.completedSales}: {seller.completedSales}
          </Badge>
          {seller.reviewCount > 0 && (
            <Badge variant="outline" className="gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {seller.avgRating.toFixed(1)} ({seller.reviewCount})
            </Badge>
          )}
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold mb-4">{m.sellerActiveListings}</h2>
      {seller.activeListings.length === 0 ? (
        <p className="text-muted-foreground text-sm mb-8">{m.noActiveListings}</p>
      ) : (
        <div className="space-y-3 mb-8">
          {seller.activeListings.map((listing: MarketplaceListing) => (
            <Card key={listing.id}>
              <CardContent className="pt-4 flex justify-between items-start gap-3">
                <div>
                  <p className="font-medium">{listing.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {listing.description || m.noDescription}
                  </p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {(m.categories as Record<string, string>)[listing.category]}
                  </Badge>
                </div>
                <span className="font-bold text-primary shrink-0">
                  {formatMoney(listing.price, listing.currency)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-4">{m.sellerReviews}</h2>
      {seller.reviews.length === 0 ? (
        <p className="text-muted-foreground text-sm">{m.noReviews}</p>
      ) : (
        <div className="space-y-3">
          {seller.reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    {review.reviewerLabel ?? m.anonymousBuyer}
                  </span>
                  <span className="flex items-center gap-0.5 text-amber-400 text-sm">
                    {review.rating}
                    <Star className="h-3 w-3 fill-current" />
                  </span>
                </div>
                {review.comment && (
                  <p className="text-sm text-muted-foreground">{review.comment}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString(
                    locale === 'ru' ? 'ru-RU' : 'en-US'
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}