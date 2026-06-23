import type { Locale } from '@/i18n/config';
import { currencyForLocale, type Currency } from '@/lib/currency';

export const RESELLER_DISCOUNT = 0.5;

export type PlanId = '3h' | '6h' | '12h' | '1d' | '7d' | '14d' | '30d';

export type Plan = {
  id: PlanId;
  priceRub: number;
  priceUsd: number;
  durationHours: number | null;
  durationDays: number | null;
  sortOrder: number;
};

export const plans: Plan[] = [
  { id: '3h', priceUsd: 0.15, priceRub: 10, durationHours: 3, durationDays: null, sortOrder: 1 },
  { id: '6h', priceUsd: 0.2, priceRub: 15, durationHours: 6, durationDays: null, sortOrder: 2 },
  { id: '12h', priceUsd: 0.45, priceRub: 38, durationHours: 12, durationDays: null, sortOrder: 3 },
  { id: '1d', priceUsd: 0.7, priceRub: 55, durationHours: null, durationDays: 1, sortOrder: 4 },
  { id: '7d', priceUsd: 4.5, priceRub: 350, durationHours: null, durationDays: 7, sortOrder: 5 },
  { id: '14d', priceUsd: 6.8, priceRub: 539, durationHours: null, durationDays: 14, sortOrder: 6 },
  { id: '30d', priceUsd: 11, priceRub: 849, durationHours: null, durationDays: 30, sortOrder: 7 },
];

export const topupAmountsRub = [100, 300, 500, 1000, 2000] as const;
export const topupAmountsUsd = [2, 5, 10, 15, 25] as const;

export type TopupAmountRub = (typeof topupAmountsRub)[number];
export type TopupAmountUsd = (typeof topupAmountsUsd)[number];
export type TopupAmount = TopupAmountRub | TopupAmountUsd;

export function getTopupAmounts(locale: Locale): readonly number[] {
  return locale === 'ru' ? topupAmountsRub : topupAmountsUsd;
}

export function getPlan(id: string): Plan | undefined {
  return plans.find((p) => p.id === id);
}

export function isValidPlanId(id: string): id is PlanId {
  return plans.some((p) => p.id === id);
}

export function getPlanPrice(plan: Plan, locale: Locale): number;
export function getPlanPrice(plan: Plan, currency: Currency): number;
export function getPlanPrice(plan: Plan, localeOrCurrency: Locale | Currency): number {
  const currency =
    localeOrCurrency === 'rub' || localeOrCurrency === 'usd'
      ? localeOrCurrency
      : currencyForLocale(localeOrCurrency);
  return currency === 'rub' ? plan.priceRub : plan.priceUsd;
}

export function getPriceRange(locale: Locale) {
  const prices = plans.map((p) => getPlanPrice(p, locale));
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function getResellerPlanPrice(plan: Plan, locale: Locale): number;
export function getResellerPlanPrice(plan: Plan, currency: Currency): number;
export function getResellerPlanPrice(plan: Plan, localeOrCurrency: Locale | Currency): number {
  const currency =
    localeOrCurrency === 'rub' || localeOrCurrency === 'usd'
      ? localeOrCurrency
      : currencyForLocale(localeOrCurrency);
  const base = currency === 'rub' ? plan.priceRub : plan.priceUsd;
  return Math.round(base * RESELLER_DISCOUNT * 100) / 100;
}

export function getResellerPriceRange(locale: Locale) {
  const prices = plans.map((p) => getResellerPlanPrice(p, locale));
  return { min: Math.min(...prices), max: Math.max(...prices) };
}