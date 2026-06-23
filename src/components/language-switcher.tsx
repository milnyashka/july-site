'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n/config';
import { useI18n } from '@/i18n/I18nProvider';

function switchLocalePath(pathname: string, locale: Locale) {
  const segments = pathname.split('/');
  segments[1] = locale;
  return segments.join('/') || `/${locale}`;
}

export function LanguageSwitcher() {
  const pathname = usePathname();
  const { locale } = useI18n();

  return (
    <div className="flex items-center rounded-md border border-border/60 bg-background/80 p-0.5 text-xs font-semibold uppercase">
      <Link
        href={switchLocalePath(pathname, 'ru')}
        className={cn(
          'rounded px-2 py-1 transition-colors',
          locale === 'ru' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        ru
      </Link>
      <Link
        href={switchLocalePath(pathname, 'en')}
        className={cn(
          'rounded px-2 py-1 transition-colors',
          locale === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        en
      </Link>
    </div>
  );
}