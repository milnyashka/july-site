'use client';

import { products } from '@/lib/products';
import { ProductCard } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';

export default function ProductsPage() {
  const { locale, dict } = useI18n();

  return (
    <div className="container py-12 md:py-20">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tighter font-headline sm:text-5xl md:text-6xl">
          {dict.productsPage.title}
        </h1>
        <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
          {dict.productsPage.walletDescription}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href={localizedPath(locale, '/wallet/topup')}>
            <Button variant="outline" className="w-full sm:w-auto">
              {dict.wallet.topUp}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href={localizedPath(locale, '/status')}>
            <Button variant="outline" className="w-full sm:w-auto">
              {dict.productsPage.allSystemsOnline}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-sm mx-auto">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}