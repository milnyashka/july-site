'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { supportLinks } from '@/lib/support-links';
import { ArrowLeft, Send } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';

export default function SupportPage() {
  const { locale, dict } = useI18n();
  const t = dict.supportPage;

  return (
    <div className="container py-12 md:py-20">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tighter font-headline sm:text-5xl md:text-6xl">
          {t.title}
        </h1>
        <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
          {t.description}
        </p>
      </div>

      <div className="max-w-md mx-auto grid gap-4">
        <a
          href={supportLinks.discord}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full"
        >
          <Button size="lg" className="w-full h-14 text-base font-bold">
            <Icon.Discord className="mr-3 h-5 w-5" />
            {t.discord}
          </Button>
        </a>

        <a
          href={supportLinks.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full"
        >
          <Button size="lg" variant="outline" className="w-full h-14 text-base font-bold">
            <Send className="mr-3 h-5 w-5" />
            {t.telegram}
          </Button>
        </a>
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground max-w-lg mx-auto">
        {t.hint}
      </p>

      <div className="mt-12 text-center">
        <Link href={localizedPath(locale, '/')}>
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t.backHome}
          </Button>
        </Link>
      </div>
    </div>
  );
}