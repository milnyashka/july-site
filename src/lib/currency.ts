import type { Locale } from '@/i18n/config';

export const RUB_PER_USD = 79;

export type Currency = 'rub' | 'usd';

export function currencyForLocale(locale: Locale): Currency {
  return locale === 'ru' ? 'rub' : 'usd';
}

export function formatMoney(amount: number, currency: Currency): string {
  if (currency === 'rub') {
    const rounded = Math.round(amount);
    const display = Math.abs(amount - rounded) < 0.005 ? String(rounded) : amount.toFixed(2);
    return `${display} ₽`;
  }
  return `$${amount.toFixed(2)}`;
}

export function usdToRub(usd: number): number {
  return Math.round(usd * RUB_PER_USD * 100) / 100;
}

export function rubToUsd(rub: number): number {
  return Math.round((rub / RUB_PER_USD) * 100) / 100;
}

export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency
): number {
  if (from === to) return amount;
  return from === 'usd' ? usdToRub(amount) : rubToUsd(amount);
}

export function formatBalanceForLocale(
  balance: number,
  storedCurrency: Currency,
  locale: Locale
): string {
  const displayCurrency = currencyForLocale(locale);
  const amount = convertAmount(balance, storedCurrency, displayCurrency);
  return formatMoney(amount, displayCurrency);
}