'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useI18n } from '@/i18n/I18nProvider';
import { useToast } from '@/hooks/use-toast';

type Props = {
  availableBalance: number;
  totalBalance?: number;
  lockedBalance?: number;
  currency: Currency;
  onBalanceChange?: () => void;
};

export function AccountWithdrawalCard({
  availableBalance,
  totalBalance,
  lockedBalance = 0,
  currency,
  onBalanceChange,
}: Props) {
  const { locale, dict } = useI18n();
  const w = dict.withdrawals;
  const { toast } = useToast();

  const [method, setMethod] = useState<WithdrawalMethod>('crypto');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);

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
    fetch('/api/withdrawals/my')
      .then((r) => r.json())
      .then((d) => setRequests(d.requests ?? []));
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/marketplace/release-holds', { method: 'POST' });

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
      onBalanceChange?.();
      const list = await fetch('/api/withdrawals/my').then((r) => r.json());
      setRequests(list.requests ?? []);
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = (s: string) => (w.statuses as Record<string, string>)[s] ?? s;
  const minAmount = minWithdrawalAmount(currency, method);
  const minNet = minWithdrawalNetAmount(currency);
  const cryptoFee = calcWithdrawalFee(minNet, 'crypto', currency);

  return (
    <Card className="bg-card/80 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5 text-primary" />
          {w.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{w.description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm space-y-1">
          <p>
            {dict.wallet.availableBalance}:{' '}
            <span className="font-semibold text-primary">
              {formatMoney(availableBalance, currency)}
            </span>
          </p>
          {lockedBalance > 0 && (
            <p className="text-xs text-amber-400">
              {dict.wallet.lockedBalanceLabel}: {formatMoney(lockedBalance, currency)}
              {totalBalance != null && (
                <span className="text-muted-foreground">
                  {' '}
                  ({dict.wallet.balance}: {formatMoney(totalBalance, currency)})
                </span>
              )}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['crypto', 'card'] as const).map((m) => (
            <Button
              key={m}
              type="button"
              variant={method === m ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMethod(m)}
            >
              {m === 'crypto' ? w.methodCrypto : w.methodCard}
            </Button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {method === 'crypto'
            ? w.feeCryptoHint
                .replace('{fee}', `$${CRYPTO_FEE_USD}`)
                .replace('{rub}', `${usdToRub(CRYPTO_FEE_USD)} ₽`)
            : w.feeCardHint
                .replace('{pct}', '3')
                .replace('{fixed}', String(CARD_FEE_FIXED_RUB))}
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
          <Label>{w.amount}</Label>
          <Input
            type="number"
            min={minAmount}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {fee !== null && net !== null && (
          <div className="text-sm space-y-1 rounded-lg border p-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{w.fee}</span>
              <span>{formatMoney(fee, currency)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>{w.youReceive}</span>
              <span className="text-primary">{formatMoney(net, currency)}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>{method === 'crypto' ? w.cryptoAddress : w.cardNumber}</Label>
          <Input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={method === 'crypto' ? w.cryptoPlaceholder : w.cardPlaceholder}
          />
        </div>

        <Button
          className="w-full"
          disabled={submitting || !amount || !destination}
          onClick={handleSubmit}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : w.submit}
        </Button>

        {requests.length > 0 && (
          <div className="pt-2 space-y-2">
            <p className="text-sm font-semibold">{w.history}</p>
            {requests.slice(0, 5).map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between text-xs border-b border-border/40 py-2"
              >
                <span>
                  {formatMoney(req.amount, req.currency)} → {formatMoney(req.netAmount, req.currency)}
                </span>
                <Badge variant={req.status === 'pending' ? 'default' : req.status === 'completed' ? 'secondary' : 'destructive'}>
                  {statusLabel(req.status)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}