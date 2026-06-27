'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Store, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { purchaseStatusLabel, type MarketplacePurchase } from '@/lib/marketplace';
import { formatMoney } from '@/lib/currency';
import { useI18n } from '@/i18n/I18nProvider';
import { useToast } from '@/hooks/use-toast';
type DealFilter = 'all' | 'open' | 'completed' | 'needs_help';

type DealPurchase = MarketplacePurchase & {
  buyerEmail?: string;
  sellerEmail?: string;
  disputeReason?: string | null;
};

const FILTERS: DealFilter[] = ['all', 'open', 'completed', 'needs_help'];

export function ModeratorMarketplacePanel() {
  const { locale, dict } = useI18n();
  const t = dict.moderatorMarketplace;
  const statusLabels = dict.marketplace.purchaseStatuses as Record<string, string>;
  const { toast } = useToast();

  const [filter, setFilter] = useState<DealFilter>('needs_help');
  const [purchases, setPurchases] = useState<DealPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/moderator/marketplace/deals?filter=${filter}`);
      const data = await res.json();
      setPurchases(data.purchases ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = async (purchaseId: string, action: 'approve' | 'reject' | 'refund') => {
    setProcessingId(purchaseId);
    try {
      const res = await fetch('/api/moderator/marketplace/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId,
          action,
          reason: rejectReason[purchaseId] ?? '',
        }),
      });
      if (!res.ok) {
        toast({ title: t.error, variant: 'destructive' });
        return;
      }
      const title = action === 'approve' ? t.approved : action === 'refund' ? t.refunded : t.rejected;
      toast({ title });
      setPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
    } finally {
      setProcessingId(null);
    }
  };

  const showActions = (p: DealPurchase) =>
    p.status !== 'refunded';

  return (
    <Card className="bg-card/80 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Store className="h-5 w-5" />
          {t.title}
        </CardTitle>
        <CardDescription>{t.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
            >
              {(t.tabs as Record<string, string>)[f]}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          purchases.map((p) => (
            <div key={p.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.buyer}: {p.buyerEmail} · {t.seller}: {p.sellerEmail}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                  </p>
                  <Badge variant="outline" className="mt-2">
                    {purchaseStatusLabel(p.status, statusLabels)}
                  </Badge>
                </div>
                <Badge>{formatMoney(p.price, p.currency)}</Badge>
              </div>

              {p.disputeReason && (
                <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-xs">
                  <span className="font-semibold">{t.disputeReason}: </span>
                  {p.disputeReason}
                </div>
              )}

              <div className="rounded border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                {p.deliveryContent}
              </div>

              {showActions(p) && (
                <>
                  <Textarea
                    placeholder={t.rejectReasonPlaceholder}
                    rows={2}
                    value={rejectReason[p.id] ?? ''}
                    onChange={(e) =>
                      setRejectReason((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                  />
                  <div className="flex gap-2 flex-wrap">
                    {(p.status === 'pending_review' || p.status === 'disputed' || p.status === 'open') && (
                      <Button
                        size="sm"
                        disabled={processingId === p.id}
                        onClick={() => handleAction(p.id, 'approve')}
                      >
                        {processingId === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-2 h-4 w-4" />
                        )}
                        {t.approve}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={processingId === p.id}
                      onClick={() => handleAction(p.id, 'refund')}
                    >
                      <X className="mr-2 h-4 w-4" />
                      {t.refund}
                    </Button>
                    {p.status !== 'completed' && p.status !== 'refunded' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === p.id}
                        onClick={() => handleAction(p.id, 'reject')}
                      >
                        <X className="mr-2 h-4 w-4" />
                        {t.reject}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}