'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wallet, KeyRound, LogOut, ArrowRight, ChevronRight, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { isReseller, isSeller, isModerator } from '@/lib/roles';
import { LicenseKeyCard } from '@/components/license-key-card';
import { CustomerTierCard, TIER_STYLES } from '@/components/customer-tier-card';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth-provider';
import { formatBalanceForLocale } from '@/lib/currency';
import { ProfileAvatar } from '@/components/profile-avatar';
import { createClient } from '@/lib/supabase/client';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

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
        refreshProfile();
      }
    };

    confirmTopup();
  }, [searchParams, toast, t.topUpPending, t.topUpSuccess, refreshProfile]);

  useEffect(() => {
    if (!user) return;

    const supabase = createClient();

    supabase
      .from('purchases')
      .select('license_key, plan_id, amount, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPurchases(data ?? []));

    supabase
      .from('transactions')
      .select('type, amount, description, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setTransactions(data ?? []));
  }, [user]);

  if (loading || !user) {
    return (
      <div className="container py-20 text-center text-muted-foreground">
        {t.loading}
      </div>
    );
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
            <h1 className="text-3xl font-bold font-headline">{t.account}</h1>
            <p className="text-muted-foreground mt-1">{profile?.email}</p>
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
              {isSeller(accountRoles) && (
                <Badge variant="outline" className="text-xs uppercase tracking-wider">
                  {t.sellerBadge}
                </Badge>
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
          <span className="text-3xl font-bold text-primary">
            {formatBalanceForLocale(profile?.balance ?? 0, profile?.currency ?? 'usd', locale)}
          </span>
        </CardHeader>
        <CardContent>
          <Link href={localizedPath(locale, '/wallet/topup')}>
            <Button className="w-full sm:w-auto">
              {t.topUp}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold font-headline mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t.myKeys}
          </h2>
          {purchases.length === 0 ? (
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
          <h2 className="text-xl font-semibold font-headline mb-4">{t.history}</h2>
          {transactions.length === 0 ? (
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