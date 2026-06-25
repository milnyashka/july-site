import { products } from './products';

export type GameId = 'pubg-mobile' | 'rust' | 'cs2';
export type GameCategoryId = 'bypass-hax' | 'accounts';

export const gameIds: GameId[] = ['pubg-mobile', 'rust', 'cs2'];
export const categoryIds: GameCategoryId[] = ['bypass-hax', 'accounts'];

export type GameCatalogItem = {
  id: GameId;
  accent: string;
  visible?: boolean;
};

export const gameCatalog: GameCatalogItem[] = [
  {
    id: 'pubg-mobile',
    accent: 'from-amber-500/25 via-orange-600/10 to-transparent',
    visible: true,
  },
  {
    id: 'rust',
    accent: 'from-red-500/25 via-orange-700/10 to-transparent',
    visible: false,
  },
  {
    id: 'cs2',
    accent: 'from-sky-500/25 via-blue-700/10 to-transparent',
    visible: false,
  },
];

export function getVisibleGames() {
  return gameCatalog.filter((g) => g.visible !== false);
}

export function isGameId(value: string): value is GameId {
  return gameIds.includes(value as GameId);
}

export function isCategoryId(value: string): value is GameCategoryId {
  return categoryIds.includes(value as GameCategoryId);
}

export function getGame(gameId: GameId) {
  return gameCatalog.find((g) => g.id === gameId);
}

export function getCategoryProducts(gameId: GameId, categoryId: GameCategoryId) {
  return products.filter(
    (p) => p.gameId === gameId && p.categoryId === categoryId
  );
}

export function categoryHasProducts(gameId: GameId, categoryId: GameCategoryId) {
  return getCategoryProducts(gameId, categoryId).length > 0;
}