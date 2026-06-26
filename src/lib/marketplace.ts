/** Комиссия площадки с P2P-продаж (роль seller) */
export const MARKETPLACE_COMMISSION = 0.05;

export type MarketplaceListingStatus = 'draft' | 'active' | 'sold' | 'cancelled';

export type MarketplaceListing = {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  currency: 'rub' | 'usd';
  status: MarketplaceListingStatus;
  createdAt: string;
};

export function calcMarketplaceFee(price: number): number {
  return Math.round(price * MARKETPLACE_COMMISSION * 100) / 100;
}

export function calcSellerPayout(price: number): number {
  return Math.round((price - calcMarketplaceFee(price)) * 100) / 100;
}