'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bitcoin, Headphones, Loader2, ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/icons';
import { useAuth } from '@/components/auth-provider';
import { currencyForLocale, formatBalanceForLocale, formatMoney } from '@/lib/currency';
import { getTopupAmounts } from '@/lib/plans';
import { supportLinks } from '@/lib/support-links';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { useToast } from '@/hooks/use-toast';

export default function TopUpPage() {
  const { user, profile, loading } = useAuth();
  const { locale, dict } = useI18n();
  const t = dict.wallet;
  const router = useRouter();
  const { toast } = useToast();
  const [cryptoLoading, setCryptoLoading] = useState<number | null>(null);
  const topupAmounts = getTopupAmounts(locale);
  const displayCurrency = currencyForLocale(locale);

  useEffect(() => {
    if (!loading && !user) {
      router.push(localizedPath(locale, '/login'));
    }
  }, [user, loading, router, locale]);

  const handleCrypto = async (amount: number) => {
    setCryptoLoading(amount);
    try {
      const res = await fetch('/api/wallet/topup/crypto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: t.topUpFailed,
          description: data.error === 'payment_not_configured' ? t.notConfigured : undefined,
          variant: 'destructive',
        });
        return;
      }

      window.location.href = data.url;
    } catch {
      toast({ title: t.topUpFailed, variant: 'destructive' });
    } finally {
      setCryptoLoading(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="container py-20 text-center text-muted-foreground">
        {t.loading}
      </div>
    );
  }

  return (
    <div className="container py-12 md:py-20 max-w-2xl">
      <Link
        href={localizedPath(locale, '/account')}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {t.backToAccount}
      </Link>

      <h1 className="text-3xl font-bold font-headline mb-2">{t.topUpTitle}</h1>
      <p className="text-muted-foreground mb-2">
        {t.topUpDescription}{' '}
        <span className="text-primary font-semibold">
          {formatBalanceForLocale(profile?.balance ?? 0, profile?.currency ?? 'usd', locale)}
        </span>
      </p>
      <p className="text-sm text-muted-foreground mb-8">{t.topUpHint}</p>

      <div className="space-y-6">
      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bitcoin className="h-5 w-5 text-primary" />
            {t.cryptoTitle}
          </CardTitle>
          <CardDescription>{t.cryptoDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {topupAmounts.map((amount) => (
            <Button
              key={`crypto-${amount}`}
              variant="outline"
              className="h-12 text-base font-semibold"
              onClick={() => handleCrypto(amount)}
              disabled={cryptoLoading !== null}
            >
              {cryptoLoading === amount ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                formatMoney(amount, displayCurrency)
              )}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Headphones className="h-5 w-5 text-primary" />
            {t.supportTitle}
          </CardTitle>
          <CardDescription>{t.supportDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
            {t.supportEmailNote.replace('{email}', profile?.email ?? '')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <a href={supportLinks.discord} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full h-12 font-semibold">
                <Icon.Discord className="mr-2 h-5 w-5" />
                {t.supportDiscord}
              </Button>
            </a>
            <a
              href={`${supportLinks.telegram}?text=${encodeURIComponent(
                t.supportTelegramMessage.replace('{email}', profile?.email ?? '')
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="w-full h-12 font-semibold">
                <Send className="mr-2 h-5 w-5" />
                {t.supportTelegram}
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground">{t.supportHint}</p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}