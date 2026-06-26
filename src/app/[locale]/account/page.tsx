'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wallet, KeyRound, LogOut, ArrowRight, ChevronRight, Shield, Store, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { isReseller, isModerator } from '@/lib/roles';
import type { MarketplaceBalanceHold, MarketplacePurchase } from '@/lib/marketplace';
import { MarketplaceOrderCard } from '@/components/marketplace-order-card';
import { LicenseKeyCard } from '@/components/license-key-card';
import { CustomerTierCard, TIER_STYLES } from '@/components/customer-tier-card';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth-provider';
import { formatBalanceForLocale } from '@/lib/currency';
import { ProfileAvatar } from '@/components/profile-avatar';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { useToast } from '@/hooks/use-toast';

type Purchase = {
  license_key: string;
  plan_id: string;
  amount: number;
  created_at: string;
};

type Transaction = {
  type: string;
  amount: number;
  description: string;
  created_at: string;
};

export default function AccountPage() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const { locale, dict } = useI18n();
  const t = dict.wallet;
  const m = dict.marketplace;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [marketPurchases, setMarketPurchases] = useState<MarketplacePurchase[]>([]);
  const [marketSales, setMarketSales] = useState<MarketplacePurchase[]>([]);
  const [marketHolds, setMarketHolds] = useState<MarketplaceBalanceHold[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const reloadMarketplace = useCallback(() => {
    return fetch('/api/marketplace/my')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { purchases?: MarketplacePurchase[]; sales?: MarketplacePurchase[]; holds?: MarketplaceBalanceHold[] } | null) => {
        setMarketPurchases(data?.purchases ?? []);
        setMarketSales(data?.sales ?? []);
        setMarketHolds(data?.holds ?? []);
      });
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push(localizedPath(locale, '/login'));
    }
  }, [user, loading, router, locale]);

  useEffect(() => {
    if (searchParams.get('topup') !== 'success') return;

    const confirmTopup = async () => {
      try {
        const res = await fetch('/api/wallet/topup/confirm', { method: 'POST' });
        const data = await res.json();
        if (data.confirmed > 0) {
          toast({ title: t.topUpSuccess });
        } else {
          toast({ title: t.topUpPending });
        }
      } catch {
        toast({ title: t.topUpPending });
      } finally {
        refreshProfile({ full: true });
      }
    };

    confirmTopup();
  }, [searchParams, toast, t.topUpPending, t.topUpSuccess, refreshProfile]);

  useEffect(() => {
    if (!user?.id) {
      setDataLoading(false);
      return;
    }

    let cancelled = false;
    setDataLoading(true);

    const load = async () => {
      try {
        await fetch('/api/marketplace/release-holds', { method: 'POST' });
        const [accountRes] = await Promise.all([
          fetch('/api/account/data', { cache: 'no-store' }),
          reloadMarketplace(),
        ]);

        if (cancelled) return;

        if (accountRes.ok) {
          const accountData = await accountRes.json();
          setPurchases(accountData.purchases ?? []);
          setTransactions(accountData.transactions ?? []);
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [user?.id, reloadMarketplace]);

  if (loading && !user) {
    return (
      <div className="container py-20 text-center text-muted-foreground">
        {t.loading}
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const planLabel = (id: string) => {
    const labels = dict.wallet.plans as Record<string, string>;
    return labels[id] ?? id;
  };

  const accountRoles = profile?.roles ?? [];

  return (
    <div className="container py-12 md:py-20 max-w-3xl">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <ProfileAvatar size="lg" editable />
          <div>
            <h1 className="text-3xl font-bold font-headline">
              {profile?.username ?? t.account}
            </h1>
            {profile?.email && (
              <p className="text-muted-foreground mt-1 text-sm">{profile.email}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {profile && (
                <Badge
                  variant="outline"
                  className={cn('text-xs font-semibold border', TIER_STYLES[profile.tier])}
                >
                  {(dict.wallet.tiers as Record<string, string>)[profile.tier]}
                </Badge>
              )}
              {isReseller(accountRoles) && !profile?.accountFrozen && (
                <Link href={localizedPath(locale, '/reseller')}>
                  <Badge className="gap-1 uppercase tracking-wider text-xs cursor-pointer hover:bg-primary/90">
                    <Shield className="h-3 w-3" />
                    {t.resellerBadge}
                    <ChevronRight className="h-3 w-3" />
                  </Badge>
                </Link>
              )}

              {isModerator(accountRoles) && (
                <Link href={localizedPath(locale, '/moderator')}>
                  <Badge variant="secondary" className="gap-1 text-xs uppercase tracking-wider cursor-pointer hover:bg-secondary/80">
                    <Shield className="h-3 w-3" />
                    {t.moderatorBadge}
                    <ChevronRight className="h-3 w-3" />
                  </Badge>
                </Link>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t.avatarHint}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => signOut().then(() => router.push(localizedPath(locale, '/')))}>
          <LogOut className="mr-2 h-4 w-4" />
          {t.logout}
        </Button>
      </div>

      {profile?.balanceFrozen && !profile.accountFrozen && (
        <div className="mb-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-200">
          {t.balanceFrozen}
        </div>
      )}

      {profile && (
        <div className="mb-6">
          <CustomerTierCard tier={profile.tier} totalSpentUsd={profile.totalSpentUsd} />
        </div>
      )}

      <Card className="mb-8 bg-primary/5 border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {t.balance}
          </CardTitle>
          <div className="text-right">
            <span className="text-3xl font-bold text-primary block">
              {formatBalanceForLocale(
                profile?.availableBalance ?? profile?.balance ?? 0,
                profile?.currency ?? 'usd',
                locale
              )}
            </span>
            <span className="text-xs text-muted-foreground">{t.availableBalance}</span>
            {profile && (profile.lockedBalance ?? 0) > 0 && (
              <p className="text-xs text-amber-400 mt-1">
                {t.lockedBalanceLabel}:{' '}
                {formatBalanceForLocale(profile.lockedBalance, profile.currency, locale)}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href={localizedPath(locale, '/wallet/topup')}>
            <Button className="w-full sm:w-auto">
              {t.topUp}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {marketHolds.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold text-amber-200 mb-2">{m.pendingPayouts}</p>
          <ul className="space-y-1 text-muted-foreground">
            {marketHolds.map((h) => (
              <li key={h.id}>
                {h.title ?? m.sale}: {formatBalanceForLocale(h.amount, h.currency, locale)} —{' '}
                {m.holdUntil}{' '}
                {new Date(h.releaseAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold font-headline mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t.myKeys}
          </h2>
          {dataLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.loading}
            </div>
          ) : purchases.length === 0 ? (
            <p className="text-muted-foreground">{t.noKeys}</p>
          ) : (
            <div className="space-y-4">
              {purchases.map((p) => (
                <LicenseKeyCard
                  key={p.license_key + p.created_at}
                  licenseKey={p.license_key}
                  planId={p.plan_id}
                  planLabel={planLabel(p.plan_id)}
                  amount={p.amount}
                  currency={profile?.currency ?? 'usd'}
                  createdAt={p.created_at}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold font-headline flex items-center gap-2">
              <Store className="h-5 w-5" />
              {m.myPurchases}
            </h2>
            <Link href={localizedPath(locale, '/marketplace')}>
              <Button variant="ghost" size="sm">
                {m.backToMarket}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          {dataLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.loading}
            </div>
          ) : marketPurchases.length === 0 ? (
            <p className="text-muted-foreground">{m.noPurchases}</p>
          ) : (
            <div className="space-y-3">
              {marketPurchases.map((mp) => (
                <MarketplaceOrderCard
                  key={mp.id}
                  purchase={mp}
                  mode="buyer"
                  onUpdated={reloadMarketplace}
                />
              ))}
            </div>
          )}
        </section>

        {!dataLoading && marketSales.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold font-headline mb-4 flex items-center gap-2">
              <Store className="h-5 w-5" />
              {m.mySales}
            </h2>
            <div className="space-y-3">
              {marketSales.map((sale) => (
                <MarketplaceOrderCard
                  key={sale.id}
                  purchase={sale}
                  mode="seller"
                  onUpdated={reloadMarketplace}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xl font-semibold font-headline mb-4">{t.history}</h2>
          {dataLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.loading}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-muted-foreground">{t.noHistory}</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.created_at + tx.description}
                  className="flex justify-between items-center py-2 border-b border-border/50 text-sm"
                >
                  <span className="text-muted-foreground">{tx.description}</span>
                  <span className={tx.amount > 0 ? 'text-green-400' : 'text-foreground'}>
                    {tx.amount > 0 ? '+' : ''}
                    {formatBalanceForLocale(Math.abs(tx.amount), profile?.currency ?? 'usd', locale)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}