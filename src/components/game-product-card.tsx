'use client';

import Link from 'next/link';
import { Shield, UserCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { GameCatalogItem, GameCategoryId } from '@/lib/game-catalog';
import { categoryHasProducts } from '@/lib/game-catalog';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { cn } from '@/lib/utils';

interface GameProductCardProps {
  game: GameCatalogItem;
}

export function GameProductCard({ game }: GameProductCardProps) {
  const { locale, dict } = useI18n();
  const t = dict.gameCatalog;
  const pc = dict.productCard;
  const gameDict = t.games[game.id];

  const categoryOptions: {
    id: GameCategoryId;
    label: string;
    icon: typeof Shield;
  }[] = [
    { id: 'bypass-hax', label: t.bypassHax, icon: Shield },
    { id: 'accounts', label: t.accounts, icon: UserCircle },
  ];

  return (
    <Card className="flex flex-col overflow-hidden bg-card/80 border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
      <div className={cn('h-28 bg-gradient-to-br border-b border-border/40', game.accent)}>
        <CardHeader className="h-full flex flex-col justify-end p-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl font-headline">{gameDict.name}</CardTitle>
              <CardDescription className="mt-1 text-sm">
                {gameDict.description}
              </CardDescription>
            </div>
            {game.id === 'pubg-mobile' && (
              <Badge className="shrink-0 bg-primary/80 uppercase tracking-wider text-[10px]">
                {pc.mostPopular}
              </Badge>
            )}
          </div>
        </CardHeader>
      </div>

      <CardContent className="p-6 pt-4 flex flex-col flex-grow gap-2">
        <p className="text-xs text-muted-foreground mb-1">{t.pickCategory}</p>
        {categoryOptions.map((opt) => {
          const Icon = opt.icon;
          const hasProducts = categoryHasProducts(game.id, opt.id);

          return (
            <Link
              key={opt.id}
              href={localizedPath(locale, `/products/${game.id}/${opt.id}`)}
              className={cn(
                'group rounded-lg border px-4 py-3 flex items-center justify-between transition',
                'hover:border-primary/60 hover:bg-primary/5 bg-muted/20'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="text-sm font-semibold block">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {hasProducts ? t.available : t.comingSoon}
                  </span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}