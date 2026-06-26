import { RUB_PER_USD, rubToUsd, type Currency } from '@/lib/currency';

export const MIN_WITHDRAWAL_RUB = 250;
export const CRYPTO_FEE_USD = 3.5;
export const CARD_FEE_PERCENT = 0.03;
export const CARD_FEE_FIXED_RUB = 30;

export type WithdrawalMethod = 'crypto' | 'card';
export type WithdrawalStatus = 'pending' | 'completed' | 'rejected';

export type WithdrawalRequest = {
  id: string;
  userId: string;
  userEmail?: string;
  method: WithdrawalMethod;
  amount: number;
  fee: number;
  netAmount: number;
  currency: Currency;
  destination: string;
  status: WithdrawalStatus;
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
};

export function amountInRub(amount: number, currency: Currency): number {
  return currency === 'rub' ? amount : Math.round(amount * RUB_PER_USD * 100) / 100;
}

export function calcWithdrawalFee(amount: number, method: WithdrawalMethod, currency: Currency): number {
  if (method === 'crypto') {
    return currency === 'usd' ? CRYPTO_FEE_USD : Math.round(CRYPTO_FEE_USD * RUB_PER_USD * 100) / 100;
  }
  if (currency === 'rub') {
    return Math.round(amount * CARD_FEE_PERCENT + CARD_FEE_FIXED_RUB * 100) / 100;
  }
  return Math.round((amount * CARD_FEE_PERCENT + rubToUsd(CARD_FEE_FIXED_RUB)) * 100) / 100;
}

export function calcWithdrawalNet(amount: number, method: WithdrawalMethod, currency: Currency): number {
  return Math.round((amount - calcWithdrawalFee(amount, method, currency)) * 100) / 100;
}

/** Минимум к получению на кошелёк (без комиссии) */
export function minWithdrawalNetAmount(currency: Currency): number {
  return currency === 'rub' ? MIN_WITHDRAWAL_RUB : rubToUsd(MIN_WITHDRAWAL_RUB);
}

/** Минимум к списанию с баланса */
export function minWithdrawalAmount(currency: Currency, method: WithdrawalMethod = 'card'): number {
  const netMin = minWithdrawalNetAmount(currency);
  if (method === 'crypto') {
    const fee = calcWithdrawalFee(netMin, 'crypto', currency);
    return Math.round((netMin + fee) * 100) / 100;
  }
  return netMin;
}

export function validateWithdrawalInput(
  amount: number,
  method: WithdrawalMethod,
  currency: Currency,
  balance: number,
  destination: string
): string | null {
  const dest = destination.trim();
  if (dest.length < 8) return 'invalid_destination';

  if (method === 'card') {
    const digits = dest.replace(/\s/g, '');
    if (!/^\d{16,19}$/.test(digits)) return 'invalid_card';
  }

  if (!Number.isFinite(amount) || amount <= 0) return 'invalid_amount';

  const minGross = minWithdrawalAmount(currency, method);
  if (amount < minGross) return 'below_minimum';

  if (method === 'card' && amountInRub(amount, currency) < MIN_WITHDRAWAL_RUB) {
    return 'below_minimum';
  }

  if (amount > balance) return 'insufficient_balance';

  const fee = calcWithdrawalFee(amount, method, currency);
  const net = calcWithdrawalNet(amount, method, currency);
  if (fee >= amount || net <= 0) return 'fee_too_high';

  return null;
}

export function maskDestination(method: WithdrawalMethod, destination: string): string {
  const d = destination.trim();
  if (method === 'card') {
    const digits = d.replace(/\s/g, '');
    return `**** ${digits.slice(-4)}`;
  }
  if (d.length <= 12) return d;
  return `${d.slice(0, 6)}...${d.slice(-4)}`;
}

export function mapWithdrawalRow(row: Record<string, unknown>): WithdrawalRequest {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userEmail: row.user_email ? String(row.user_email) : undefined,
    method: row.method as WithdrawalMethod,
    amount: Number(row.amount),
    fee: Number(row.fee),
    netAmount: Number(row.net_amount),
    currency: row.currency === 'rub' ? 'rub' : 'usd',
    destination: String(row.destination),
    status: row.status as WithdrawalStatus,
    adminNote: row.admin_note ? String(row.admin_note) : null,
    createdAt: String(row.created_at),
    processedAt: row.processed_at ? String(row.processed_at) : null,
  };
}