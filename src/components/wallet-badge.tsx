'use client';

import Link from 'next/link';
import { Wallet, LogIn, BadgePercent, ShieldAlert } from 'lucide-react';
import { canAccessModeratorPanel } from '@/lib/permissions';
import { isReseller } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import { formatBalanceForLocale } from '@/lib/currency';
import { ProfileAvatar } from '@/components/profile-avatar';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';

export function WalletBadge() {
  const { user, profile, loading } = useAuth();
  const { locale, dict } = useI18n();
  const t = dict.wallet;

  if (loading) return null;

  if (!user) {
    return (
      <Link href={localizedPath(locale, '/login')}>
        <Button variant="outline" size="sm" className="gap-1.5">
          <LogIn className="h-4 w-4" />
          <span className="hidden sm:inline">{t.login}</span>
        </Button>
      </Link>
    );
  }

  const accountRoles = profile?.roles ?? [];

  return (
    <div className="flex items-center gap-2">
      {canAccessModeratorPanel(accountRoles) && (
        <Link href={localizedPath(locale, '/moderator')}>
          <Button variant="secondary" size="sm" className="gap-1.5 font-semibold hidden sm:inline-flex">
            <ShieldAlert className="h-4 w-4" />
            {dict.nav.moderator}
          </Button>
        </Link>
      )}
      {isReseller(accountRoles) && (
        <Link href={localizedPath(locale, '/reseller')}>
          <Button variant="default" size="sm" className="gap-1.5 font-semibold hidden sm:inline-flex">
            <BadgePercent className="h-4 w-4" />
            {dict.nav.reseller}
          </Button>
        </Link>
      )}
      <Link href={localizedPath(locale, '/wallet/topup')}>
        <Button variant="outline" size="sm" className="gap-1.5 font-semibold">
          <Wallet className="h-4 w-4 text-primary" />
          <span>
            {formatBalanceForLocale(profile?.balance ?? 0, profile?.currency ?? 'usd', locale)}
          </span>
        </Button>
      </Link>
      <Link href={localizedPath(locale, '/account')} title={t.account}>
        <ProfileAvatar size="sm" />
      </Link>
    </div>
  );
}