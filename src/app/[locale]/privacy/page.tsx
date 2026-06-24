'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';

export default function PrivacyPage() {
  const { locale, dict } = useI18n();
  const t = dict.privacyPage;

  return (
    <div className="container py-12 md:py-20">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tighter font-headline sm:text-5xl md:text-6xl">
          {t.title}
        </h1>
        <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
          {t.lastUpdated}
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-8">
        {t.intro && (
          <p className="text-muted-foreground leading-relaxed">{t.intro}</p>
        )}

        {t.sections.map((section) => (
          <section key={section.title} className="rounded-lg border border-border/50 bg-card/50 p-6">
            <h2 className="text-lg font-semibold font-headline">{section.title}</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">{section.content}</p>
          </section>
        ))}
      </div>

      <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link href={localizedPath(locale, '/support')}>
          <Button size="lg">Поддержка / Support</Button>
        </Link>
        <Link href={localizedPath(locale, '/terms')}>
          <Button size="lg" variant="outline">
            Пользовательское соглашение / Terms
          </Button>
        </Link>
      </div>
    </div>
  );
}
