'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bitcoin, Headphones, Loader2, ArrowLeft, Send, Bot, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/icons';
import { useAuth } from '@/components/auth-provider';
import { formatBalanceForLocale } from '@/lib/currency';
import { supportLinks } from '@/lib/support-links';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { useToast } from '@/hooks/use-toast';

export default function TopUpPage() {
  const { user, profile, loading } = useAuth();
  const { locale, dict } = useI18n();
  const t = dict.wallet;
  const router = useRouter();
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<'crypto' | 'cryptobot' | 'sbp' | null>(null);
  const [loadingAmount, setLoadingAmount] = useState<number | null>(null);

  const rubTopupAmounts = [25, 50, 100, 250, 500, 1000, 2500];
  const sbpTopupAmounts = [10, ...rubTopupAmounts];
  const cryptoTopupAmounts = [1, 5, 10, 15, 25, 50, 100];
  const topupAmounts =
    selectedMethod === 'crypto'
      ? cryptoTopupAmounts
      : selectedMethod === 'sbp'
        ? sbpTopupAmounts
        : rubTopupAmounts;

  useEffect(() => {
    if (!loading && !user) {
      router.push(localizedPath(locale, '/login'));
    }
  }, [user, loading, router, locale]);

  // Pure top-up functions (no loading inside)
  const topUpCrypto = async (amount: number) => {
    const res = await fetch('/api/wallet/topup/crypto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, locale }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast({
        title: t.topUpFailed,
        description: data.error === 'payment_not_configured' ? t.notConfigured : undefined,
        variant: 'destructive',
      });
      throw new Error(data.error || 'failed');
    }

    window.location.href = data.url;
  };

  const topUpCryptobot = async (amount: number) => {
    const res = await fetch('/api/wallet/topup/cryptobot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, locale }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast({
        title: t.topUpFailed,
        description: data.error === 'payment_not_configured' ? t.notConfigured : undefined,
        variant: 'destructive',
      });
      throw new Error(data.error || 'failed');
    }

    window.location.href = data.url;
  };

  const topUpSbp = async (amount: number) => {
    const res = await fetch('/api/wallet/topup/sbp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, locale }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast({
        title: t.topUpFailed,
        description: data.error === 'payment_not_configured' ? t.notConfigured : undefined,
        variant: 'destructive',
      });
      throw new Error(data.error || 'failed');
    }

    window.location.href = data.url;
  };

  const handleAmount = async (amount: number) => {
    if (!selectedMethod) return;

    setLoadingAmount(amount);
    try {
      if (selectedMethod === 'crypto') {
        await topUpCrypto(amount);
      } else if (selectedMethod === 'cryptobot') {
        await topUpCryptobot(amount);
      } else if (selectedMethod === 'sbp') {
        await topUpSbp(amount);
      }
    } catch {
      // errors already toasted inside
    } finally {
      setLoadingAmount(null);
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

      {/* Payment method selector */}
      <div className="mb-6">
        <div className="text-lg font-semibold mb-4">{t.selectPaymentMethod}</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { id: 'crypto' as const, label: t.cryptoTitle, icon: Bitcoin, desc: t.cryptoDescription },
            { id: 'cryptobot' as const, label: t.cryptobotTitle, icon: Bot, desc: t.cryptobotDescription },
            { id: 'sbp' as const, label: t.sbpTitle, icon: QrCode, desc: t.sbpDescription },
          ].map((method) => {
            const IconComp = method.icon;
            const isActive = selectedMethod === method.id;
            return (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition hover:border-primary/70 bg-card/60",
                  isActive && "border-primary bg-primary/5 ring-1 ring-primary/30"
                )}
              >
                <div className="flex items-center gap-3 mb-1">
                  <IconComp className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-base">{method.label}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{method.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Amounts - shown only after method selected */}
      {selectedMethod && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold">
              {t.selectAmount}
              {selectedMethod === 'crypto' ? ' ($)' : ' (₽)'}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedMethod(null);
                setLoadingAmount(null);
              }}
            >
              {t.changePaymentMethod}
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {topupAmounts.map((amount) => (
              <Button
                key={amount}
                variant="outline"
                className="h-14 text-xl font-bold"
                onClick={() => handleAmount(amount)}
                disabled={loadingAmount !== null}
              >
                {loadingAmount === amount ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : selectedMethod === 'crypto' ? (
                  `$${amount}`
                ) : (
                  `${amount} ₽`
                )}
              </Button>
            ))}
          </div>

          <p className="mt-3 text-xs text-muted-foreground text-center">
            {t.topUpRedirectHint}
          </p>
        </div>
      )}

      {/* Manual support (always visible) */}
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
  );
}