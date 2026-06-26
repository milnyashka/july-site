'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  calcWithdrawalFee,
  calcWithdrawalNet,
  minWithdrawalAmount,
  minWithdrawalNetAmount,
  type WithdrawalMethod,
  type WithdrawalRequest,
  CRYPTO_FEE_USD,
  CARD_FEE_FIXED_RUB,
  MIN_WITHDRAWAL_RUB,
} from '@/lib/withdrawals';
import { formatMoney, usdToRub, type Currency } from '@/lib/currency';
import { useAuth } from '@/components/auth-provider';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { useToast } from '@/hooks/use-toast';
export default function MarketplaceWithdrawPage() {
  const { locale, dict } = useI18n();
  const w = dict.withdrawals;
  const walletT = dict.wallet;
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [method, setMethod] = useState<WithdrawalMethod>('crypto');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);

  const currency = (profile?.currency === 'rub' ? 'rub' : 'usd') as Currency;
  const availableBalance = profile?.availableBalance ?? profile?.balance ?? 0;
  const lockedBalance = profile?.lockedBalance ?? 0;

  const amountNum = Number(amount);
  const fee = useMemo(() => {
    if (!Number.isFinite(amountNum) || amountNum <= 0) return null;
    return calcWithdrawalFee(amountNum, method, currency);
  }, [amountNum, method, currency]);

  const net = useMemo(() => {
    if (!Number.isFinite(amountNum) || amountNum <= 0 || fee === null) return null;
    return calcWithdrawalNet(amountNum, method, currency);
  }, [amountNum, fee, method, currency]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(localizedPath(locale, '/login'));
    }
  }, [authLoading, user, router, locale]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/withdrawals/my')
      .then((r) => r.json())
      .then((d) => setRequests(d.requests ?? []));
  }, [user]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/withdrawals/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, amount: amountNum, destination }),
      });
      const data = await res.json();

      if (!res.ok) {
        const errKey = data.error as keyof typeof w.errors;
        toast({ title: w.errors[errKey] ?? w.failed, variant: 'destructive' });
        return;
      }

      toast({ title: w.submitted });
      setAmount('');
      setDestination('');
      await refreshProfile();
      const list = await fetch('/api/withdrawals/my').then((r) => r.json());
      setRequests(list.requests ?? []);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return <p className="container py-20 text-center text-muted-foreground">{w.loading}</p>;
  }

  const statusLabel = (s: string) => (w.statuses as Record<string, string>)[s] ?? s;
  const minAmount = minWithdrawalAmount(currency, method);
  const minNet = minWithdrawalNetAmount(currency);
  const cryptoFee = calcWithdrawalFee(minNet, 'crypto', currency);

  return (
    <div className="container py-12 md:py-20 max-w-2xl">
      <Link
        href={localizedPath(locale, '/marketplace/sell')}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {w.backToSell}
      </Link>

      <h1 className="text-3xl font-bold font-headline mb-2">{w.title}</h1>
      <p className="text-muted-foreground mb-6">{w.description}</p>

      <Card className="mb-6 bg-primary/5 border-primary/30">
        <CardContent className="pt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <span className="text-muted-foreground">{walletT.availableBalance}</span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary">
              {formatMoney(availableBalance, currency)}
            </span>
            {lockedBalance > 0 && (
              <p className="text-xs text-amber-400 mt-1">
                {walletT.lockedBalanceLabel}: {formatMoney(lockedBalance, currency)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{w.newRequest}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant={method === 'crypto' ? 'default' : 'outline'}
              onClick={() => setMethod('crypto')}
            >
              {w.methodCrypto}
            </Button>
            <Button
              type="button"
              variant={method === 'card' ? 'default' : 'outline'}
              onClick={() => setMethod('card')}
            >
              {w.methodCard}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {method === 'crypto'
              ? w.feeCryptoHint.replace('{fee}', `$${CRYPTO_FEE_USD}`).replace('{rub}', formatMoney(usdToRub(CRYPTO_FEE_USD), 'rub'))
              : w.feeCardHint.replace('{pct}', '3').replace('{fixed}', String(CARD_FEE_FIXED_RUB))}
          </p>
          <p className="text-xs text-muted-foreground">
            {method === 'crypto'
              ? w.minHintCrypto
                  .replace('{min}', formatMoney(minAmount, currency))
                  .replace('{netMin}', formatMoney(minNet, currency))
                  .replace('{fee}', formatMoney(cryptoFee, currency))
              : w.minHint
                  .replace('{min}', formatMoney(minAmount, currency))
                  .replace('{minRub}', `${MIN_WITHDRAWAL_RUB} ₽`)}
          </p>

          <div className="space-y-2">
            <Label htmlFor="amount">{w.amount} ({currency.toUpperCase()})</Label>
            <Input
              id="amount"
              type="number"
              min={minAmount}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {fee !== null && net !== null && (
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{w.fee}</span>
                <span>{formatMoney(fee, currency)}</span>
              </div>
              <div className="flex justify-between font-semibold text-primary">
                <span>{w.youReceive}</span>
                <span>{formatMoney(net, currency)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="dest">
              {method === 'crypto' ? w.cryptoAddress : w.cardNumber}
            </Label>
            <Input
              id="dest"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder={method === 'crypto' ? w.cryptoPlaceholder : w.cardPlaceholder}
              className={method === 'crypto' ? 'font-mono text-sm' : ''}
            />
          </div>

          <Button className="w-full" disabled={submitting || !amount || !destination} onClick={handleSubmit}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {w.submit}
          </Button>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-xl font-semibold mb-4">{w.history}</h2>
        {requests.length === 0 ? (
          <p className="text-muted-foreground text-sm">{w.noHistory}</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="rounded-lg border p-4 text-sm">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <p className="font-medium">
                      {req.method === 'crypto' ? w.methodCrypto : w.methodCard}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(req.createdAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                    </p>
                  </div>
                  <Badge
                    variant={req.status === 'pending' ? 'default' : req.status === 'completed' ? 'secondary' : 'destructive'}
                  >
                    {statusLabel(req.status)}
                  </Badge>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{w.youReceive}</span>
                  <span className="text-foreground font-medium">{formatMoney(req.netAmount, req.currency)}</span>
                </div>
                {req.adminNote && req.status === 'rejected' && (
                  <p className="text-xs text-destructive mt-2">{req.adminNote}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}