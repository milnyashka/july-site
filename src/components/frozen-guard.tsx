'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';

const ALLOWED_WHEN_FROZEN = ['/frozen', '/support'];

export function FrozenGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const { locale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user || !profile?.accountFrozen) return;

    const allowed = ALLOWED_WHEN_FROZEN.some((p) => {
      const full = localizedPath(locale, p);
      return pathname === full || pathname.startsWith(`${full}/`);
    });

    if (!allowed) {
      router.replace(localizedPath(locale, '/frozen'));
    }
  }, [loading, user, profile?.accountFrozen, pathname, router, locale]);

  return <>{children}</>;
}