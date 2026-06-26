'use client';

import { useCallback, useEffect, useState } from 'react';
import { useVisibleInterval } from '@/hooks/use-visible-interval';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MarketplaceChatPanel } from '@/components/marketplace-chat-panel';
import { SellerProfileChip } from '@/components/seller-profile-chip';
import type { MarketplaceThread } from '@/lib/marketplace';
import { useAuth } from '@/components/auth-provider';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { cn } from '@/lib/utils';

export default function MarketplaceMessagesPage() {
  const { locale, dict } = useI18n();
  const m = dict.marketplace;
  const c = m.chat;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [threads, setThreads] = useState<MarketplaceThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    const res = await fetch(`/api/marketplace/chat/threads?locale=${locale}`);
    const data = await res.json();
    setThreads(data.threads ?? []);
    setLoading(false);
  }, [locale]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(localizedPath(locale, '/login'));
    }
  }, [authLoading, user, router, locale]);

  useEffect(() => {
    if (!user) return;
    loadThreads();
  }, [user, loadThreads]);

  useVisibleInterval(user ? loadThreads : () => {}, user ? 30_000 : null);

  const active = threads.find((t) => t.id === activeId);

  if (authLoading || !user) {
    return <p className="container py-20 text-center text-muted-foreground">{m.loading}</p>;
  }

  return (
    <div className="container py-12 md:py-20 max-w-4xl">
      <Link
        href={localizedPath(locale, '/marketplace')}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {m.backToMarket}
      </Link>

      <h1 className="text-3xl font-bold font-headline mb-6">{c.inbox}</h1>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {loading ? (
            <p className="text-muted-foreground text-sm">{c.loading}</p>
          ) : threads.length === 0 ? (
            <p className="text-muted-foreground text-sm">{c.noThreads}</p>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                className={cn(
                  'w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50',
                  activeId === t.id && 'border-primary bg-primary/5'
                )}
              >
                <p className="font-medium text-sm truncate">{t.listingTitle}</p>
                <div className="mt-1 pointer-events-none">
                  <SellerProfileChip party={t.otherParty} size="sm" />
                </div>
                {t.lastMessage && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{t.lastMessage}</p>
                )}
              </button>
            ))
          )}
        </div>

        <Card className="min-h-[420px] flex flex-col overflow-hidden">
          {active ? (
            <MarketplaceChatPanel
              threadId={active.id}
              title={active.listingTitle}
              otherParty={active.otherParty}
            />
          ) : (
            <CardContent className="flex flex-1 items-center justify-center text-muted-foreground text-sm py-20">
              {c.selectThread}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}