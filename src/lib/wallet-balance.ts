export type WalletBalance = {
  balance: number;
  locked: number;
  available: number;
};

export function computeAvailableBalance(balance: number, locked: number): number {
  return Math.max(Math.round((balance - locked) * 100) / 100, 0);
}