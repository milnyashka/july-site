'use client';

import Link from 'next/link';
import { ArrowLeft, Clock, Send } from 'lucide-react';
import { ProductCard } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import type { GameCategoryId, GameId } from '@/lib/game-catalog';
import { getCategoryProducts } from '@/lib/game-catalog';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { supportLinks } from '@/lib/support-links';

interface CategoryProductsViewProps {
  gameId: GameId;
  categoryId: GameCategoryId;
  reseller?: boolean;
  backHref?: string;
  backLabel?: string;
}

export function CategoryProductsView({
  gameId,
  categoryId,
  reseller = false,
  backHref,
  backLabel,
}: CategoryProductsViewProps) {
  const { locale, dict } = useI18n();
  const t = dict.gameCatalog;

  const gameDict = t.games[gameId];
  const categoryLabel =
    categoryId === 'bypass-hax' ? t.bypassHax : t.accounts;
  const items = getCategoryProducts(gameId, categoryId);
  const backLink = backHref ?? localizedPath(locale, '/products');
  const backText = backLabel ?? t.backToGames;

  return (
    <div className="container py-12 md:py-20">
      <Link
        href={backLink}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {backText}
      </Link>

      <div className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-2">
          {gameDict.name}
        </p>
        <h1 className="text-3xl md:text-4xl font-bold font-headline">{categoryLabel}</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          {t.categoryDescription
            .replace('{game}', gameDict.name)
            .replace('{category}', categoryLabel)}
        </p>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 max-w-sm mx-auto md:max-w-none md:grid-cols-2 lg:grid-cols-3">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} reseller={reseller} />
          ))}
        </div>
      ) : (
        <div className="max-w-md mx-auto rounded-xl border border-dashed border-border/60 bg-muted/10 p-8 text-center">
          <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <p className="text-lg font-semibold">{t.comingSoonTitle}</p>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            {t.comingSoonDescription
              .replace('{game}', gameDict.name)
              .replace('{category}', categoryLabel)}
          </p>
          <a
            href={`${supportLinks.telegram}?text=${encodeURIComponent(
              t.supportMessage
                .replace('{game}', gameDict.name)
                .replace('{category}', categoryLabel)
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">
              <Send className="mr-2 h-4 w-4" />
              {t.askSupport}
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}