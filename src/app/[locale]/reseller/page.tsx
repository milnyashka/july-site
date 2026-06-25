'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BadgePercent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GameProductCard } from '@/components/game-product-card';
import { getVisibleGames } from '@/lib/game-catalog';
import { useAuth } from '@/components/auth-provider';
import { isReseller, resolveAccountRole } from '@/lib/roles';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';

export default function ResellerPage() {
  const { user, profile, loading } = useAuth();
  const { locale, dict } = useI18n();
  const t = dict.resellerPage;
  const router = useRouter();
  const accountRole = resolveAccountRole(profile?.role, user);

  useEffect(() => {
    if (!loading && !user) {
      router.push(localizedPath(locale, '/login'));
      return;
    }
    if (!loading && user && !isReseller(accountRole)) {
      router.push(localizedPath(locale, '/account'));
    }
  }, [user, accountRole, loading, router, locale]);

  if (loading || !user || !isReseller(accountRole)) {
    return (
      <div className="container py-20 text-center text-muted-foreground">
        {dict.wallet.loading}
      </div>
    );
  }

  return (
    <div className="container py-12 md:py-20">
      <div className="mb-12 text-center max-w-2xl mx-auto">
        <Badge className="mb-4 uppercase tracking-wider">{t.badge}</Badge>
        <h1 className="text-4xl font-bold tracking-tighter font-headline sm:text-5xl md:text-6xl">
          {t.title}
        </h1>
        <p className="mt-4 text-muted-foreground md:text-xl">{t.description}</p>
        <p className="mt-2 text-sm text-primary font-semibold flex items-center justify-center gap-2">
          <BadgePercent className="h-4 w-4" />
          {t.discountNote}
        </p>
        <div className="mt-6">
          <Link href={localizedPath(locale, '/wallet/topup')}>
            <Button variant="outline" className="w-full sm:w-auto">
              {dict.wallet.topUp}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex justify-center">
        {getVisibleGames().map((game) => (
          <div key={game.id} className="w-full max-w-md">
            <GameProductCard game={game} productsBasePath="/reseller/products" />
          </div>
        ))}
      </div>
    </div>
  );
}