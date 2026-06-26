'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MarketplaceChatPanel } from '@/components/marketplace-chat-panel';
import type { MarketplaceListing } from '@/lib/marketplace';
import { useAuth } from '@/components/auth-provider';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';

type Props = {
  listing: MarketplaceListing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MarketplaceChatDialog({ listing, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { locale, dict } = useI18n();
  const c = dict.marketplace.chat;
  const router = useRouter();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !listing || !user) {
      setThreadId(null);
      return;
    }

    if (listing.sellerId === user.id) {
      return;
    }

    setLoading(true);
    fetch('/api/marketplace/chat/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: listing.id }),
    })
      .then((r) => r.json())
      .then((data) => setThreadId(data.threadId ?? null))
      .finally(() => setLoading(false));
  }, [open, listing, user]);

  const handleOpen = (next: boolean) => {
    if (next && !user) {
      onOpenChange(false);
      router.push(localizedPath(locale, '/login'));
      return;
    }
    onOpenChange(next);
  };

  if (!listing) return null;

  const sellerParty =
    listing.sellerLabel && listing.sellerId
      ? {
          id: listing.sellerId,
          label: listing.sellerLabel,
          avatarUrl: listing.sellerAvatarUrl ?? null,
          avgRating: listing.sellerAvgRating ?? 0,
          reviewCount: listing.sellerReviewCount ?? 0,
          isSellerProfile: true,
        }
      : undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle>{c.title}</DialogTitle>
          <DialogDescription>{listing.title}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : threadId ? (
          <MarketplaceChatPanel
            threadId={threadId}
            title={listing.title}
            otherParty={sellerParty}
          />
        ) : (
          <p className="text-center text-muted-foreground py-12 text-sm">{c.failed}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}