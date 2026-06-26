import type { Plan } from '@/lib/plans';
import { getPlanPrice, RESELLER_DISCOUNT } from '@/lib/plans';
import type { Currency } from '@/lib/currency';
import { rubToUsd } from '@/lib/currency';

export type CustomerTier = 'basic' | 'bronze' | 'silver' | 'gold';

export type TierInfo = {
  id: CustomerTier;
  minUsd: number;
  maxUsd: number;
  discount: number;
};

export const CUSTOMER_TIERS: TierInfo[] = [
  { id: 'basic', minUsd: 0, maxUsd: 100, discount: 0 },
  { id: 'bronze', minUsd: 100, maxUsd: 250, discount: 0.05 },
  { id: 'silver', minUsd: 250, maxUsd: 500, discount: 0.1 },
  { id: 'gold', minUsd: 500, maxUsd: 1000, discount: 0.2 },
];

export function getTierFromSpentUsd(spentUsd: number): CustomerTier {
  if (spentUsd >= 500) return 'gold';
  if (spentUsd >= 250) return 'silver';
  if (spentUsd >= 100) return 'bronze';
  return 'basic';
}

export function getTierInfo(tier: CustomerTier): TierInfo {
  return CUSTOMER_TIERS.find((t) => t.id === tier) ?? CUSTOMER_TIERS[0];
}

export function getTierDiscount(tier: CustomerTier): number {
  return getTierInfo(tier).discount;
}

export function getNextTier(tier: CustomerTier): TierInfo | null {
  const idx = CUSTOMER_TIERS.findIndex((t) => t.id === tier);
  if (idx < 0 || idx >= CUSTOMER_TIERS.length - 1) return null;
  return CUSTOMER_TIERS[idx + 1];
}

export function getTierProgress(spentUsd: number, tier: CustomerTier) {
  const current = getTierInfo(tier);
  const next = getNextTier(tier);
  if (!next) {
    return { spentUsd, nextTier: null as CustomerTier | null, remainingUsd: 0, percent: 100 };
  }
  const range = next.minUsd - current.minUsd;
  const progress = Math.max(0, Math.min(spentUsd - current.minUsd, range));
  const percent = Math.round((progress / range) * 100);
  return {
    spentUsd,
    nextTier: next.id,
    remainingUsd: Math.max(0, next.minUsd - spentUsd),
    percent,
  };
}

export function applyTierDiscount(price: number, tier: CustomerTier): number {
  const discount = getTierDiscount(tier);
  return Math.round(price * (1 - discount) * 100) / 100;
}

export function applyPurchaseDiscounts(
  price: number,
  opts: { reseller?: boolean; tier?: CustomerTier }
): number {
  let amount = price;
  if (opts.reseller) {
    amount = Math.round(amount * RESELLER_DISCOUNT * 100) / 100;
  }
  return applyTierDiscount(amount, opts.tier ?? 'basic');
}

export function getFinalPlanPrice(
  plan: Plan,
  currency: Currency,
  opts: { reseller?: boolean; tier?: CustomerTier }
): number {
  const base = getPlanPrice(plan, currency);
  return applyPurchaseDiscounts(base, opts);
}

export function sumPurchasesToUsd(
  purchases: { amount: number; amount_usd?: number | null }[],
  fallbackCurrency: Currency
): number {
  return purchases.reduce((sum, p) => {
    if (p.amount_usd != null && !Number.isNaN(Number(p.amount_usd))) {
      return sum + Number(p.amount_usd);
    }
    const amount = Number(p.amount);
    return sum + (fallbackCurrency === 'rub' ? rubToUsd(amount) : amount);
  }, 0);
}