import type { GameCategoryId, GameId } from './game-catalog';

export type Product = {
  id: string;
  name: string;
  description: string;
  priceMin: number;
  priceMax: number;
  image: string;
  rating: number;
  reviewsCount: number;
  tags: ('MOST POPULAR' | 'FEATURED')[];
  gameId: GameId;
  categoryId: GameCategoryId;
};

export type Review = {
  id: string;
  source: 'Discord';
  username: string;
  handle: string;
  avatarUrl: string;
  rating: number;
  content: string;
  timestamp: string;
  proofUrl?: string;
};
