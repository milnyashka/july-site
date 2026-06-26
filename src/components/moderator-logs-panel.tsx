'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ScrollText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ModeratorLogRow } from '@/lib/moderator-log';
import { useI18n } from '@/i18n/I18nProvider';

type ModeratorLogsPanelProps = {
  apiPath?: string;
};

export function ModeratorLogsPanel({ apiPath = '/api/moderator/logs' }: ModeratorLogsPanelProps) {
  const { locale, dict } = useI18n();
  const t = dict.moderator.logs;

  const [logs, setLogs] = useState<ModeratorLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [viewAll, setViewAll] = useState(false);

  const actionLabel = (action: string) =>
    (t.actions as Record<string, string>)[action] ?? action;

  const ROLE_KEYS: Record<string, string> = {
    owner: 'roleOwner',
    moderator: 'roleModerator',
    moderator_senior: 'roleModeratorSenior',
    reseller: 'roleReseller',
    user: 'roleUser',
    seller: 'roleSeller',
  };

  const roleLabel = (role: string) =>
    (dict.admin as Record<string, string>)[ROLE_KEYS[role] ?? ''] ?? role;

  const load = useCallback(async (offset: number, append: boolean) => {
    const res = await fetch(`${apiPath}?limit=30&offset=${offset}`);
    const data = await res.json();
    if (!res.ok) return;
    setTotal(data.total ?? 0);
    setViewAll(Boolean(data.viewAll));
    setLogs((prev) => (append ? [...prev, ...(data.logs ?? [])] : data.logs ?? []));
  }, [apiPath]);

  useEffect(() => {
    setLoading(true);
    load(0, false).finally(() => setLoading(false));
  }, [load]);

  const handleMore = async () => {
    setLoadingMore(true);
    try {
      await load(logs.length, true);
    } finally {
      setLoadingMore(false);
    }
  };

  const formatDetails = (log: ModeratorLogRow) => {
    const d = log.details;
    if (log.action === 'zero_balance' && d.zeroed != null) {
      return `${t.detailZeroed}: ${d.zeroed}`;
    }
    if (log.action === 'delete_purchase' && d.licenseKey) {
      return `${t.detailKey}: ${String(d.licenseKey)}`;
    }
    if (d.accountFrozen != null) {
      const base = d.accountFrozen ? t.detailFrozenOn : t.detailFrozenOff;
      if (d.reason) return `${base}: ${String(d.reason)}`;
      return base;
    }
    if (d.balanceFrozen != null) {
      return d.balanceFrozen ? t.detailBalanceFrozenOn : t.detailBalanceFrozenOff;
    }
    return '';
  };

  return (
    <Card className="bg-card/80 border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          {t.title}
        </CardTitle>
        <CardDescription>
          {viewAll ? t.subtitleAdmin : t.subtitleSenior}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-border/60 bg-background/40 p-3 text-sm space-y-1.5"
              >
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <span className="font-medium">{log.actorEmail}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {log.actorRoles.map((r) => (
                    <Badge key={r} variant="outline" className="text-[10px]">
                      {roleLabel(r)}
                    </Badge>
                  ))}
                  <Badge variant="secondary" className="text-[10px]">
                    {actionLabel(log.action)}
                  </Badge>
                </div>
                {log.targetEmail && (
                  <p className="text-xs text-muted-foreground">
                    → {log.targetEmail}
                  </p>
                )}
                {formatDetails(log) && (
                  <p className="text-xs text-primary/80">{formatDetails(log)}</p>
                )}
              </div>
            ))}
            {logs.length < total && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loadingMore}
                onClick={handleMore}
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : t.loadMore}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}