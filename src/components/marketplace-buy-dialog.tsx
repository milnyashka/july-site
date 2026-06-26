'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShoppingBag, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { MarketplaceListing } from '@/lib/marketplace';
import { buyerChargeForListing } from '@/lib/marketplace';
import { formatMoney } from '@/lib/currency';
import type { Currency } from '@/lib/currency';
import { useAuth } from '@/components/auth-provider';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { useToast } from '@/hooks/use-toast';

type Props = {
  listing: MarketplaceListing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchased?: () => void;
};

export function MarketplaceBuyDialog({ listing, open, onOpenChange, onPurchased }: Props) {
  const { user, profile, refreshProfile } = useAuth();
  const { locale, dict } = useI18n();
  const m = dict.marketplace;
  const w = dict.wallet;
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [delivery, setDelivery] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!listing) return null;

  const handleBuy = async () => {
    if (!user) {
      onOpenChange(false);
      router.push(localizedPath(locale, '/login'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/marketplace/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'insufficient_balance') {
          toast({ title: w.insufficientBalance, description: w.topUpFirst, variant: 'destructive' });
          onOpenChange(false);
          router.push(localizedPath(locale, '/wallet/topup'));
          return;
        }
        throw new Error(data.error);
      }

      if (data.deliveryContent) {
        setDelivery(data.deliveryContent);
        toast({ title: m.purchaseSuccess });
      } else if (data.status === 'pending_review') {
        setPendingReview(true);
        toast({ title: m.purchasePending });
      } else {
        toast({ title: m.purchaseSuccess });
      }
      await refreshProfile({ full: true, force: true });
      onPurchased?.();
    } catch {
      toast({ title: m.purchaseFailed, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!delivery) return;
    await navigator.clipboard.writeText(delivery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setDelivery(null);
      setPendingReview(false);
      setCopied(false);
    }
    onOpenChange(next);
  };

  const currency = listing.currency;
  const buyerCurrency = (profile?.currency ?? 'usd') as Currency;
  const buyerCharge = buyerChargeForListing(listing.price, listing.currency, buyerCurrency);
  const available = profile?.availableBalance ?? profile?.balance ?? 0;
  const converted = listing.currency !== buyerCurrency;
  const canAfford = available >= buyerCharge;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {delivery ? m.deliveryTitle : pendingReview ? m.purchasePendingTitle : m.buyTitle}
          </DialogTitle>
          <DialogDescription>
            {delivery
              ? m.deliveryHint
              : pendingReview
                ? m.purchasePendingHint
                : listing.description || listing.title}
          </DialogDescription>
        </DialogHeader>

        {pendingReview ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
            {m.purchasePendingHint}
          </div>
        ) : delivery ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 font-mono text-sm whitespace-pre-wrap break-all">
              {delivery}
            </div>
            <Button className="w-full" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? m.copied : m.copyDelivery}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{listing.title}</p>
                {listing.sellerLabel && (
                  <p className="text-xs text-muted-foreground mt-1">{m.seller}: {listing.sellerLabel}</p>
                )}
              </div>
              <Badge variant="secondary">
                {(m.categories as Record<string, string>)[listing.category]}
              </Badge>
            </div>

            <div className="rounded-lg border p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{m.price}</span>
                <span className="font-semibold">{formatMoney(listing.price, currency)}</span>
              </div>
              {converted && user && (
                <div className="flex justify-between text-amber-400">
                  <span>{m.youPay}</span>
                  <span className="font-semibold">{formatMoney(buyerCharge, buyerCurrency)}</span>
                </div>
              )}
              {converted && (
                <p className="text-xs text-muted-foreground pt-1">{m.currencyConvertNote}</p>
              )}
              <p className="text-xs text-muted-foreground">{m.noTierDiscount}</p>
            </div>

            {user && profile && !canAfford && (
              <p className="text-sm text-destructive">
                {profile.lockedBalance > 0 && profile.availableBalance < buyerCharge
                  ? w.insufficientAvailable
                  : w.insufficientBalance}
              </p>
            )}

            <Button
              className="w-full"
              disabled={loading || (!!user && !canAfford)}
              onClick={handleBuy}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingBag className="mr-2 h-4 w-4" />
              )}
              {m.buyFor} {formatMoney(converted && user ? buyerCharge : listing.price, converted && user ? buyerCurrency : currency)}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}