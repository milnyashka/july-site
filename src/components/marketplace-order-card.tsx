'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Loader2, MessageCircle, MessageCircleWarning, RotateCcw, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  type MarketplacePurchase,
  purchaseStatusLabel,
} from '@/lib/marketplace';
import { formatMoney } from '@/lib/currency';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { useToast } from '@/hooks/use-toast';

type Props = {
  purchase: MarketplacePurchase;
  mode: 'buyer' | 'seller';
  onUpdated?: () => void;
};

export function MarketplaceOrderCard({ purchase, mode, onUpdated }: Props) {
  const { locale, dict } = useI18n();
  const m = dict.marketplace;
  const { toast } = useToast();

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [showRefund, setShowRefund] = useState(false);

  const statusLabels = m.purchaseStatuses as Record<string, string>;
  const canShowDelivery =
    mode === 'buyer' &&
    ['open', 'completed', 'disputed'].includes(purchase.status) &&
    purchase.deliveryContent;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/marketplace/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId: purchase.id }),
      });
      if (!res.ok) {
        toast({ title: m.confirmFailed, variant: 'destructive' });
        return;
      }
      toast({ title: m.confirmSuccess });
      onUpdated?.();
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/marketplace/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId: purchase.id, rating, comment }),
      });
      if (!res.ok) {
        toast({ title: m.reviewFailed, variant: 'destructive' });
        return;
      }
      toast({ title: m.reviewSubmitted });
      setShowReview(false);
      onUpdated?.();
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/marketplace/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId: purchase.id, reason: disputeReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: m.disputeFailed, variant: 'destructive' });
        return;
      }
      toast({ title: m.disputeSubmitted });
      if (data.supportUrl) {
        window.open(data.supportUrl, '_blank', 'noopener,noreferrer');
      }
      setShowDispute(false);
      onUpdated?.();
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/marketplace/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId: purchase.id, reason: refundReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        const key = data.error as keyof typeof m.refundErrors;
        toast({
          title: m.refundErrors[key] ?? m.refundFailed,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: m.refundSuccess });
      setShowRefund(false);
      onUpdated?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex justify-between items-start gap-3">
          <div>
            <p className="font-medium">{purchase.title}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(purchase.createdAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
            </p>
            {mode === 'buyer' && (
              <Link
                href={localizedPath(locale, `/marketplace/seller/${purchase.sellerId}`)}
                className="text-xs text-primary hover:underline mt-1 inline-block"
              >
                {m.viewSellerProfile}
              </Link>
            )}
          </div>
          <div className="text-right space-y-1">
            <span className="text-sm font-semibold block">
              {formatMoney(
                mode === 'buyer' ? (purchase.buyerPaid ?? purchase.price) : purchase.sellerPayout,
                mode === 'buyer' ? (purchase.buyerCurrency ?? purchase.currency) : purchase.currency
              )}
            </span>
            <Badge
              variant={
                purchase.status === 'completed'
                  ? 'secondary'
                  : purchase.status === 'open'
                    ? 'default'
                    : purchase.status === 'disputed'
                      ? 'destructive'
                      : purchase.status === 'pending_review'
                        ? 'default'
                        : purchase.status === 'rejected' || purchase.status === 'refunded'
                          ? 'destructive'
                          : 'outline'
              }
            >
              {purchaseStatusLabel(purchase.status, statusLabels)}
            </Badge>
          </div>
        </div>

        {purchase.status === 'open' && (
          <p className="text-xs text-muted-foreground rounded border p-2 bg-muted/30">
            {mode === 'buyer' ? m.openDealBuyer : m.openDealSeller}
          </p>
        )}

        {purchase.status === 'pending_review' && (
          <p className="text-xs text-muted-foreground rounded border p-2 bg-muted/30">
            {mode === 'buyer' ? m.pendingReviewBuyer : m.pendingReviewSeller}
          </p>
        )}

        {purchase.status === 'rejected' && purchase.rejectReason && (
          <p className="text-xs text-destructive">{purchase.rejectReason}</p>
        )}

        {mode === 'seller' && purchase.holdReleaseAt && purchase.status === 'completed' && (
          <p className="text-xs text-amber-400">
            {m.holdUntil}:{' '}
            {new Date(purchase.holdReleaseAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
          </p>
        )}

        {canShowDelivery && (
          <>
            {expanded ? (
              <div className="space-y-2">
                <div className="rounded border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap break-all">
                  {purchase.deliveryContent}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(purchase.deliveryContent);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="mr-2 h-3 w-3" /> : <Copy className="mr-2 h-3 w-3" />}
                  {copied ? m.copied : m.copyDelivery}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setExpanded(true)}>
                {m.viewDelivery}
              </Button>
            )}
          </>
        )}

        <Link href={localizedPath(locale, '/marketplace/messages')}>
          <Button size="sm" variant="outline" className="w-full sm:w-auto">
            <MessageCircle className="mr-2 h-3 w-3" />
            {m.chatToSeller}
          </Button>
        </Link>

        {mode === 'buyer' && purchase.status === 'open' && (
          <Button size="sm" className="w-full sm:w-auto" disabled={loading} onClick={handleConfirm}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : m.confirmDeal}
          </Button>
        )}

        {mode === 'buyer' && purchase.status === 'completed' && !purchase.hasReview && (
          <>
            {!showReview ? (
              <Button size="sm" variant="outline" onClick={() => setShowReview(true)}>
                <Star className="mr-2 h-3 w-3" />
                {m.leaveReview}
              </Button>
            ) : (
              <div className="space-y-2 border rounded-lg p-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className={n <= rating ? 'text-amber-400' : 'text-muted-foreground'}
                    >
                      <Star className="h-5 w-5 fill-current" />
                    </button>
                  ))}
                </div>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={m.reviewPlaceholder}
                  rows={2}
                />
                <Button size="sm" disabled={loading} onClick={handleReview}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : m.submitReview}
                </Button>
              </div>
            )}
          </>
        )}

        {mode === 'buyer' &&
          ['open', 'completed'].includes(purchase.status) &&
          !purchase.hasDispute && (
            <>
              {!showDispute ? (
                <Button size="sm" variant="destructive" onClick={() => setShowDispute(true)}>
                  <MessageCircleWarning className="mr-2 h-3 w-3" />
                  {m.openDispute}
                </Button>
              ) : (
                <div className="space-y-2 border border-destructive/30 rounded-lg p-3">
                  <Textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder={m.disputePlaceholder}
                    rows={3}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={loading || disputeReason.trim().length < 10}
                    onClick={handleDispute}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : m.submitDispute}
                  </Button>
                </div>
              )}
            </>
          )}

        {mode === 'seller' &&
          ['open', 'completed', 'disputed'].includes(purchase.status) && (
            <>
              {!showRefund ? (
                <Button size="sm" variant="outline" onClick={() => setShowRefund(true)}>
                  <RotateCcw className="mr-2 h-3 w-3" />
                  {m.sellerRefund}
                </Button>
              ) : (
                <div className="space-y-2 border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{m.sellerRefundHint}</p>
                  <Textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder={m.sellerRefundPlaceholder}
                    rows={2}
                  />
                  <Button size="sm" variant="destructive" disabled={loading} onClick={handleRefund}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : m.sellerRefundConfirm}
                  </Button>
                </div>
              )}
            </>
          )}

        {purchase.hasDispute && (
          <p className="text-xs text-muted-foreground">{m.disputeOpen}</p>
        )}
      </CardContent>
    </Card>
  );
}