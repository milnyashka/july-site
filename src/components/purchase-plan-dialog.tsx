'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShoppingCart, KeyRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { plans, getPlanPrice, type PlanId } from '@/lib/plans';
import { getFinalPlanPrice } from '@/lib/tiers';
import { currencyForLocale, formatBalanceForLocale, formatMoney } from '@/lib/currency';
import { useAuth } from '@/components/auth-provider';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PurchasePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reseller?: boolean;
}

export function PurchasePlanDialog({ open, onOpenChange, reseller }: PurchasePlanDialogProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { locale, dict } = useI18n();
  const t = dict.purchaseDialog;
  const w = dict.wallet;
  const router = useRouter();
  const { toast } = useToast();
  const displayCurrency = currencyForLocale(locale);

  const [selectedId, setSelectedId] = useState<PlanId>('30d');
  const [loading, setLoading] = useState(false);
  const [purchasedKey, setPurchasedKey] = useState<string | null>(null);

  const tier = profile?.tier ?? 'basic';
  const selected = plans.find((p) => p.id === selectedId)!;
  const priceForPlan = (plan: typeof selected) =>
    getFinalPlanPrice(plan, displayCurrency, { reseller, tier });
  const selectedPrice = priceForPlan(selected);
  const planLabels = dict.wallet.plans;
  const planDurations = dict.wallet.planDurations;

  const handlePurchase = async () => {
    if (!user) {
      onOpenChange(false);
      router.push(localizedPath(locale, '/login'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/wallet/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'insufficient_balance') {
          toast({
            title: w.insufficientBalance,
            description: w.topUpFirst,
            variant: 'destructive',
          });
          onOpenChange(false);
          router.push(localizedPath(locale, '/wallet/topup'));
          return;
        }
        throw new Error(data.error);
      }

      setPurchasedKey(data.key);
      await refreshProfile();
      toast({ title: w.purchaseSuccess, description: w.keyDelivered });
    } catch {
      toast({ title: w.purchaseFailed, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPurchasedKey(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="font-headline">
            {reseller ? dict.resellerPage.dialogTitle : t.title}
          </DialogTitle>
          <DialogDescription>
            {reseller ? dict.resellerPage.dialogDescription : t.description}
          </DialogDescription>
        </DialogHeader>

        {purchasedKey ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground mb-1">{w.yourKey}</p>
              <p className="font-mono text-sm break-all">{purchasedKey}</p>
            </div>
            <Button className="w-full" onClick={() => handleOpenChange(false)}>
              {t.done}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {plans.map((plan) => {
                const isSelected = plan.id === selectedId;
                const label = planLabels[plan.id as keyof typeof planLabels];
                const duration = planDurations[plan.id as keyof typeof planDurations];
                const price = priceForPlan(plan);
                const basePrice = getPlanPrice(plan, displayCurrency);

                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedId(plan.id)}
                    className={cn(
                      'w-full rounded-lg border p-4 text-left transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border/50 bg-card/50 hover:border-primary/40'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold font-headline">{label}</span>
                          {plan.id === '30d' && (
                            <Badge variant="secondary" className="text-[10px] uppercase">
                              {dict.productCard.mostPopular}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{duration}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {price < basePrice && (
                          <span className="block text-xs text-muted-foreground line-through">
                            {formatMoney(basePrice, displayCurrency)}
                          </span>
                        )}
                        <span className="text-lg font-bold text-primary">
                          {formatMoney(price, displayCurrency)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {user && profile && (
              <p className="text-center text-sm text-muted-foreground">
                {w.balance}:{' '}
                <span className="text-foreground font-medium">
                  {formatBalanceForLocale(profile.balance, profile.currency, locale)}
                </span>
              </p>
            )}

            <Button className="w-full font-bold" size="lg" onClick={handlePurchase} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="mr-2 h-4 w-4" />
              )}
              {user && profile
                ? `${w.buyFor} ${formatMoney(selectedPrice, displayCurrency)}`
                : dict.productCard.purchase}
            </Button>

            <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <KeyRound className="h-3 w-3" />
              {w.instantKey}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}