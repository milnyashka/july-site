'use client';

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useI18n } from "@/i18n/I18nProvider"
import { localizedPath } from "@/i18n/localized-path"

export function CTA() {
  const { locale, dict } = useI18n();

  return (
    <section className="container text-center">
      <div className="bg-card rounded-lg p-8 md:p-12 border border-primary/20 shadow-lg shadow-primary/10">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tighter font-headline">{dict.cta.title}</h2>
        <p className="mt-4 max-w-xl mx-auto text-muted-foreground">
          {dict.cta.description}
        </p>
        <div className="mt-8">
            <Link href={localizedPath(locale, '/products')}>
                <Button size="lg">
                    {dict.cta.browseProducts}
                </Button>
            </Link>
        </div>
      </div>
    </section>
  )
}