'use client';

import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatBalanceForLocale, type Currency } from '@/lib/currency';
import type { Locale } from '@/i18n/config';
import { useI18n } from '@/i18n/I18nProvider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type LicenseKeyCardProps = {
  licenseKey: string;
  planId: string;
  planLabel: string;
  amount: number;
  currency: Currency;
  createdAt: string;
  locale: Locale;
};

export function LicenseKeyCard({
  licenseKey,
  planId,
  planLabel,
  amount,
  currency,
  createdAt,
  locale,
}: LicenseKeyCardProps) {
  const { dict } = useI18n();
  const t = dict.wallet;
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const maskedKey =
    licenseKey.length > 8
      ? `${licenseKey.slice(0, 4)}${'•'.repeat(Math.min(licenseKey.length - 8, 12))}${licenseKey.slice(-4)}`
      : licenseKey;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(licenseKey);
      setCopied(true);
      toast({ title: t.keyCopied });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: t.keyCopyFailed, variant: 'destructive' });
    }
  };

  const date = new Date(createdAt);

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold font-headline truncate">{planLabel}</p>
            <p className="text-xs text-muted-foreground">
              {date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              {' · '}
              {formatBalanceForLocale(amount, currency, locale)}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 uppercase text-[10px] tracking-wider">
          {planId}
        </Badge>
      </div>

      <div className="p-4 space-y-3">
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="w-full rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10"
        >
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
            {revealed ? t.yourKey : t.tapToRevealKey}
          </p>
          <p className={cn('font-mono text-sm break-all', !revealed && 'tracking-widest')}>
            {revealed ? licenseKey : maskedKey}
          </p>
        </button>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? t.hideKey : t.showKey}
          </Button>
          <Button type="button" size="sm" className="flex-1" onClick={handleCopy}>
            {copied ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? t.copied : t.copyKey}
          </Button>
        </div>
      </div>
    </div>
  );
}