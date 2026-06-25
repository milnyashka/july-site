import { notFound } from 'next/navigation';
import { CategoryProductsView } from '@/components/category-products-view';
import {
  categoryIds,
  gameIds,
  isCategoryId,
  isGameId,
} from '@/lib/game-catalog';

type PageProps = {
  params: Promise<{ locale: string; game: string; category: string }>;
};

export default async function ProductCategoryPage({ params }: PageProps) {
  const { game, category } = await params;

  if (!isGameId(game) || !isCategoryId(category)) {
    notFound();
  }

  return <CategoryProductsView gameId={game} categoryId={category} />;
}

export function generateStaticParams() {
  const params: { locale: string; game: string; category: string }[] = [];

  for (const locale of ['en', 'ru']) {
    for (const game of gameIds) {
      for (const category of categoryIds) {
        params.push({ locale, game, category });
      }
    }
  }

  return params;
}