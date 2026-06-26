'use client';

import Link from 'next/link';
import { User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SellerRatingBadge } from '@/components/seller-rating-badge';
import type { MarketplacePartyPreview } from '@/lib/marketplace';

import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { cn } from '@/lib/utils';

type Props = {
  party: MarketplacePartyPreview;
  size?: 'sm' | 'md';
  showRating?: boolean;
  className?: string;
};

export function SellerProfileChip({ party, size = 'md', showRating = true, className }: Props) {
  const { locale, dict } = useI18n();
  const m = dict.marketplace;
  const avatarSize = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';

  const content = (
    <div className={cn('flex items-center gap-3 min-w-0', className)}>
      <Avatar className={cn(avatarSize, 'shrink-0')}>
        <AvatarImage src={party.avatarUrl ?? undefined} alt={party.label} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
          {party.label && !party.label.includes('@') ? (
            party.label.slice(0, 2).toUpperCase()
          ) : party.label ? (
            party.label.replace(/\*+/g, '').slice(0, 2).toUpperCase() || '?'
          ) : (
            <User className="h-4 w-4" />
          )}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'font-medium truncate',
            size === 'sm' ? 'text-sm' : 'text-base',
            party.isSellerProfile && 'text-primary'
          )}
        >
          {party.label}
        </p>
        {showRating && (
          <SellerRatingBadge
            rating={party.avgRating}
            reviewCount={party.reviewCount}
            noReviewsLabel={m.noReviewsShort}
          />
        )}
      </div>
    </div>
  );

  if (party.isSellerProfile) {
    return (
      <Link
        href={localizedPath(locale, `/marketplace/seller/${party.id}`)}
        className="block rounded-lg hover:bg-muted/50 transition-colors p-1 -m-1"
      >
        {content}
      </Link>
    );
  }

  return <div className="p-1 -m-1">{content}</div>;
}