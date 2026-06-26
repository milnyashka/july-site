'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  rating: number;
  reviewCount: number;
  noReviewsLabel?: string;
  className?: string;
};

export function SellerRatingBadge({ rating, reviewCount, noReviewsLabel, className }: Props) {
  if (reviewCount <= 0) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>
        {noReviewsLabel ?? '—'}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 text-amber-400', className)}>
      <Star className="h-3.5 w-3.5 fill-current shrink-0" />
      <span className="text-xs font-semibold text-foreground">{rating.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">({reviewCount})</span>
    </span>
  );
}