'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldOff, LogOut, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth-provider';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';

export default function FrozenAccountPage() {
  const { user, profile, loading, signOut } = useAuth();
  const { locale, dict } = useI18n();
  const t = dict.frozenPage;
  const router = useRouter();

  if (loading) {
    return (
      <div className="container py-24 flex justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.replace(localizedPath(locale, '/login'));
    return null;
  }

  if (!profile?.accountFrozen) {
    router.replace(localizedPath(locale, '/account'));
    return null;
  }

  const reason = profile.accountFreezeReason?.trim() || t.defaultReason;

  return (
    <div className="container flex items-center justify-center py-16 md:py-24">
      <Card className="w-full max-w-lg border-destructive/40 bg-card/90 shadow-lg shadow-destructive/5">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
            <ShieldOff className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-headline text-destructive">{t.title}</CardTitle>
          <CardDescription className="text-base">{t.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t.reasonLabel}</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{reason}</p>
          </div>
          <p className="text-sm text-muted-foreground text-center">{t.hint}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={localizedPath(locale, '/support')} className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <MessageCircle className="h-4 w-4" />
                {t.support}
              </Button>
            </Link>
            <Button
              variant="destructive"
              className="flex-1 gap-2"
              onClick={() =>
                signOut().then(() => router.push(localizedPath(locale, '/')))
              }
            >
              <LogOut className="h-4 w-4" />
              {t.logout}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}