import { notFound } from 'next/navigation';
import { CategoryProductsView } from '@/components/category-products-view';
import {
  categoryIds,
  gameIds,
  isCategoryId,
  isGameId,
} from '@/lib/game-catalog';
import { getDictionary } from '@/i18n/get-dictionary';
import { isLocale } from '@/i18n/config';
import { localizedPath } from '@/i18n/localized-path';

type PageProps = {
  params: Promise<{ locale: string; game: string; category: string }>;
};

export default async function ResellerProductCategoryPage({ params }: PageProps) {
  const { locale, game, category } = await params;

  if (!isGameId(game) || !isCategoryId(category)) {
    notFound();
  }

  const dict = isLocale(locale) ? await getDictionary(locale) : await getDictionary('ru');

  return (
    <CategoryProductsView
      gameId={game}
      categoryId={category}
      reseller
      backHref={localizedPath(isLocale(locale) ? locale : 'ru', '/reseller')}
      backLabel={dict.gameCatalog.backToReseller}
    />
  );
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