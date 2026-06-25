'use client';

import { getVisibleGames } from "@/lib/game-catalog"
import { GameProductCard } from "@/components/game-product-card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useI18n } from "@/i18n/I18nProvider"
import { localizedPath } from "@/i18n/localized-path"

export function FeaturedProducts() {
  const { locale, dict } = useI18n();
  const featured = getVisibleGames()

  return (
    <section className="container">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">{dict.featuredProducts.eyebrow}</h2>
            <p className="mt-2 text-3xl md:text-4xl font-bold tracking-tighter font-headline">
            {dict.featuredProducts.title}
            </p>
            <p className="mt-4 max-w-xl text-muted-foreground">
            {dict.featuredProducts.description}
            </p>
        </div>
        <div className="flex-shrink-0">
            <Link href={localizedPath(locale, '/products')}>
                <Button variant="ghost">
                    {dict.featuredProducts.viewAll}
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </Link>
        </div>
      </div>
      
      <div className="flex justify-center">
        {featured.map((game) => (
          <div key={game.id} className="w-full max-w-md">
            <GameProductCard game={game} />
          </div>
        ))}
      </div>
    </section>
  )
}