'use client';

import { useState } from 'react';
import { Star, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PurchasePlanDialog } from '@/components/purchase-plan-dialog';
import type { Product } from '@/lib/types';
import { currencyForLocale, formatMoney } from '@/lib/currency';
import { plans } from '@/lib/plans';
import { getFinalPlanPrice } from '@/lib/tiers';
import { useAuth } from '@/components/auth-provider';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';

interface ProductCardProps {
  product: Product;
  reseller?: boolean;
}

export function ProductCard({ product, reseller }: ProductCardProps) {
  const { locale, dict } = useI18n();
  const { profile } = useAuth();
  const t = dict.productCard;
  const [dialogOpen, setDialogOpen] = useState(false);
  const displayCurrency = currencyForLocale(locale);
  const tier = profile?.tier ?? 'basic';

  const prices = plans.map((plan) =>
    getFinalPlanPrice(plan, displayCurrency, { reseller, tier })
  );
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  const tagLabel = (tag: Product['tags'][number]) =>
    tag === 'MOST POPULAR' ? t.mostPopular : t.featured;

  const openDialog = () => setDialogOpen(true);

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={openDialog}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDialog();
          }
        }}
        className="flex flex-col overflow-hidden transition-all duration-300 ease-in-out bg-card/80 hover:bg-card hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-1 border-border/50 hover:border-primary/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <CardHeader className="relative p-6">
          <div className="absolute top-4 left-4 flex flex-col gap-1.5">
            {reseller && (
              <Badge className="bg-primary/80 backdrop-blur-sm text-xs uppercase tracking-wider">
                {dict.resellerPage.badge} −40%
              </Badge>
            )}
            {product.tags.map(tag => (
              <Badge key={tag} variant={tag === 'MOST POPULAR' ? 'default' : 'secondary'} className="bg-primary/80 backdrop-blur-sm text-xs uppercase tracking-wider">
                {tagLabel(tag)}
              </Badge>
            ))}
          </div>
          <div className="text-right text-primary">
            <span className="block text-xs uppercase tracking-wider text-muted-foreground">{t.from}</span>
            <span className="text-2xl font-bold">{formatMoney(min, displayCurrency)}</span>
            <span className="block text-xs text-muted-foreground mt-0.5">{t.to} {formatMoney(max, displayCurrency)}</span>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0 flex-grow flex flex-col">
          <CardTitle className="text-xl font-headline">{dict.product.name}</CardTitle>
          <CardDescription className="mt-2 text-muted-foreground flex-grow">{dict.product.description}</CardDescription>

          <div className="flex justify-between items-center mt-6">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-4 w-4',
                    i < Math.round(product.rating) ? 'text-accent fill-accent' : 'text-muted-foreground/30'
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">({product.reviewsCount} {t.reviews})</p>
          </div>

          <div className="mt-6">
            <Button className="w-full font-bold" size="lg" onClick={(e) => { e.stopPropagation(); openDialog(); }}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              {t.purchase}
            </Button>
          </div>
        </CardContent>
      </Card>

      <PurchasePlanDialog open={dialogOpen} onOpenChange={setDialogOpen} reseller={reseller} />
    </>
  );
}