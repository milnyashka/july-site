'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Store, PlusCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketplaceListingCard } from '@/components/marketplace-listing-card';
import { MarketplaceBuyDialog } from '@/components/marketplace-buy-dialog';
import { MarketplaceChatDialog } from '@/components/marketplace-chat-dialog';
import {
  MARKETPLACE_CATEGORIES,
  type MarketplaceCategory,
  type MarketplaceListing,
} from '@/lib/marketplace';
import { useAuth } from '@/components/auth-provider';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { cn } from '@/lib/utils';

export default function MarketplacePage() {
  const { locale, dict } = useI18n();
  const m = dict.marketplace;
  const { user } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const listingsRef = useRef<MarketplaceListing[]>([]);
  const [category, setCategory] = useState<MarketplaceCategory | 'all'>('all');
  const [selected, setSelected] = useState<MarketplaceListing | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chatListing, setChatListing] = useState<MarketplaceListing | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const loadListings = useCallback(async () => {
    const hasListings = listingsRef.current.length > 0;
    if (hasListings) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ locale });
      if (category !== 'all') params.set('category', category);
      const res = await fetch(`/api/marketplace/listings?${params}`, { cache: 'no-store' });
      const data = await res.json();
      const next = data.listings ?? [];
      listingsRef.current = next;
      setListings(next);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, locale]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  return (
    <div className="container py-12 md:py-20">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary mb-2">
            <Store className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">{m.eyebrow}</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tighter font-headline">{m.title}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{m.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user && (
            <Link href={localizedPath(locale, '/marketplace/messages')}>
              <Button variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                {m.chatInbox}
              </Button>
            </Link>
          )}
          {user && (
            <Link href={localizedPath(locale, '/marketplace/sell')}>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                {m.sellCta}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={category === 'all' ? 'default' : 'outline'}
          onClick={() => setCategory('all')}
        >
          {m.allCategories}
        </Button>
        {MARKETPLACE_CATEGORIES.map((cat) => (
          <Button
            key={cat}
            size="sm"
            variant={category === cat ? 'default' : 'outline'}
            onClick={() => setCategory(cat)}
          >
            {(m.categories as Record<string, string>)[cat]}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className={cn('grid gap-6 sm:grid-cols-2 lg:grid-cols-3')}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card/50 p-5 space-y-4 animate-pulse">
              <div className="h-5 w-2/3 rounded bg-muted" />
              <div className="h-4 w-full rounded bg-muted/70" />
              <div className="h-4 w-4/5 rounded bg-muted/70" />
              <div className="flex justify-between pt-2">
                <div className="h-8 w-24 rounded bg-muted" />
                <div className="h-8 w-20 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <p className="text-muted-foreground">{m.empty}</p>
          {user && (
            <Link href={localizedPath(locale, '/marketplace/sell')}>
              <Button variant="outline">{m.createFirst}</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className={cn('grid gap-6 sm:grid-cols-2 lg:grid-cols-3', refreshing && 'opacity-60 pointer-events-none')}>
          {listings.map((listing) => (
            <MarketplaceListingCard
              key={listing.id}
              listing={listing}
              isOwnListing={user?.id === listing.sellerId}
              onBuy={(l) => {
                setSelected(l);
                setDialogOpen(true);
              }}
              onChat={(l) => {
                setChatListing(l);
                setChatOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <MarketplaceBuyDialog
        listing={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onPurchased={loadListings}
      />

      <MarketplaceChatDialog
        listing={chatListing}
        open={chatOpen}
        onOpenChange={setChatOpen}
      />
    </div>
  );
}