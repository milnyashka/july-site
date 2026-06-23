'use client';

import { Status } from '@/components/status';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';

export default function StatusPage() {
  const { locale, dict } = useI18n();

  return (
    <div className="container py-12 md:py-20">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tighter font-headline sm:text-5xl md:text-6xl">
          {dict.statusPage.title}
        </h1>
        <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
          {dict.statusPage.description}
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <Status />
      </div>

      <div className="mt-12 text-center">
         <Link href={localizedPath(locale, '/products')}>
            <Button size="lg" variant="outline">
                {dict.statusPage.browseProducts}
            </Button>
        </Link>
      </div>
    </div>
  );
}