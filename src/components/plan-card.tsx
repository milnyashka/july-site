'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, KeyRound, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/auth-provider';
import { currencyForLocale, formatBalanceForLocale, formatMoney } from '@/lib/currency';
import { getPlanPrice, type Plan } from '@/lib/plans';
import { getFinalPlanPrice } from '@/lib/tiers';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { useToast } from '@/hooks/use-toast';
import { purchaseErrorMessage } from '@/lib/purchase-errors';

interface PlanCardProps {
  plan: Plan;
  label: string;
  durationLabel: string;
  popular?: boolean;
  reseller?: boolean;
}

export function PlanCard({ plan, label, durationLabel, popular, reseller }: PlanCardProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { locale, dict } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [purchasedKey, setPurchasedKey] = useState<string | null>(null);
  const t = dict.wallet;
  const displayCurrency = currencyForLocale(locale);
  const basePrice = getPlanPrice(plan, displayCurrency);
  const price = getFinalPlanPrice(plan, displayCurrency, {
    reseller,
    tier: profile?.tier ?? 'basic',
  });

  const handlePurchase = async () => {
    if (!user) {
      router.push(localizedPath(locale, '/login'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/wallet/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'insufficient_balance') {
          toast({
            title: t.insufficientBalance,
            description: t.topUpFirst,
            variant: 'destructive',
          });
          router.push(localizedPath(locale, '/wallet/topup'));
          return;
        }
        throw new Error(data.error ?? 'unknown');
      }

      setPurchasedKey(data.key);
      await refreshProfile({ full: true, force: true });
      toast({ title: t.purchaseSuccess, description: t.keyDelivered });
    } catch (err) {
      const code = err instanceof Error ? err.message : undefined;
      toast({
        title: purchaseErrorMessage(code, t.purchaseErrors, t.purchaseFailed),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col bg-card/80 border-border/50">
      <CardHeader className="relative p-6">
        {popular && (
          <Badge className="absolute top-4 left-4 uppercase tracking-wider text-xs">
            {dict.productCard.mostPopular}
          </Badge>
        )}
        <div className="text-right text-primary">
          {price < basePrice && (
            <span className="block text-sm text-muted-foreground line-through">
              {formatMoney(basePrice, displayCurrency)}
            </span>
          )}
          <span className="text-3xl font-bold">{formatMoney(price, displayCurrency)}</span>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-0 flex-grow flex flex-col">
        <CardTitle className="text-xl font-headline">{label}</CardTitle>
        <CardDescription className="mt-2 text-muted-foreground">{durationLabel}</CardDescription>

        {purchasedKey && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs text-muted-foreground mb-1">{t.yourKey}</p>
            <p className="font-mono text-sm break-all">{purchasedKey}</p>
          </div>
        )}

        <div className="mt-6">
          <Button className="w-full font-bold" size="lg" onClick={handlePurchase} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="mr-2 h-4 w-4" />
            )}
            {user && profile
              ? `${t.buyFor} ${formatMoney(price, displayCurrency)}`
              : dict.productCard.purchase}
          </Button>
          {user && profile && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {t.availableBalance}:{' '}
              {formatBalanceForLocale(profile.availableBalance ?? profile.balance, profile.currency, locale)}
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-6 pt-0 text-xs text-muted-foreground">
        <KeyRound className="h-3 w-3 mr-1" />
        {t.instantKey}
      </CardFooter>
    </Card>
  );
}