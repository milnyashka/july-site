'use client';

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  getTierDiscount,
  getTierProgress,
  type CustomerTier,
} from '@/lib/tiers';
import { useI18n } from '@/i18n/I18nProvider';

export const TIER_STYLES: Record<CustomerTier, string> = {
  basic: 'bg-muted text-muted-foreground border-border',
  bronze: 'bg-amber-950/40 text-amber-300 border-amber-700/50',
  silver: 'bg-slate-800/60 text-slate-200 border-slate-500/50',
  gold: 'bg-yellow-950/40 text-yellow-300 border-yellow-600/50',
};

type CustomerTierCardProps = {
  tier: CustomerTier;
  totalSpentUsd: number;
};

export function CustomerTierCard({ tier, totalSpentUsd }: CustomerTierCardProps) {
  const { dict } = useI18n();
  const t = dict.wallet;
  const tierLabels = dict.wallet.tiers as Record<CustomerTier, string>;
  const progress = getTierProgress(totalSpentUsd, tier);
  const discount = Math.round(getTierDiscount(tier) * 100);

  return (
    <div className={`rounded-xl border p-4 ${TIER_STYLES[tier]}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-xs uppercase tracking-wider opacity-80">{t.buyerTier}</p>
          <p className="text-xl font-bold font-headline">{tierLabels[tier]}</p>
        </div>
        <Badge variant="outline" className="border-current/30 bg-background/20">
          {discount > 0 ? t.tierDiscount.replace('{percent}', String(discount)) : t.tierNoDiscount}
        </Badge>
      </div>

      <p className="text-sm opacity-90 mb-1">
        {t.tierSpent.replace('{amount}', totalSpentUsd.toFixed(2))}
      </p>
      <p className="text-xs opacity-70 mb-2">{t.tierProductsOnly}</p>

      {progress.nextTier ? (
        <>
          <Progress value={progress.percent} className="h-2 mb-2" />
          <p className="text-xs opacity-80">
            {t.tierProgress
              .replace('{next}', tierLabels[progress.nextTier])
              .replace('{amount}', progress.remainingUsd.toFixed(2))}
          </p>
        </>
      ) : (
        <p className="text-xs opacity-80">{t.tierMax}</p>
      )}
    </div>
  );
}