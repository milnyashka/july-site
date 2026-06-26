'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, KeyRound, Loader2, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth-provider';
import { formatMoney, type Currency } from '@/lib/currency';
import { canAccessModeratorPanel, canViewModeratorLogs } from '@/lib/permissions';
import { type AccountRole } from '@/lib/roles';
import { ModeratorLogsPanel } from '@/components/moderator-logs-panel';
import { ModeratorMarketplacePanel } from '@/components/moderator-marketplace-panel';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { useToast } from '@/hooks/use-toast';

type PurchaseRow = {
  id: string;
  licenseKey: string;
  planId: string;
  amount: number;
  createdAt: string;
};

type TargetUser = {
  email: string;
  balance: number;
  currency: Currency;
  role: AccountRole;
  roles: AccountRole[];
  accountFrozen: boolean;
  balanceFrozen: boolean;
  accountFreezeReason: string | null;
  purchases: PurchaseRow[];
};

const ROLE_DICT_KEYS: Record<AccountRole, string> = {
  owner: 'roleOwner',
  moderator: 'roleModerator',
  moderator_senior: 'roleModeratorSenior',
  reseller: 'roleReseller',
  user: 'roleUser',
  seller: 'roleSeller',
};

export default function ModeratorPage() {
  const { user, profile, loading } = useAuth();
  const { locale, dict } = useI18n();
  const t = dict.moderator;
  const adminT = dict.admin;
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [target, setTarget] = useState<TargetUser | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');

  const accountRoles = profile?.roles ?? [];
  const allowed = canAccessModeratorPanel(accountRoles);
  const showLogs = canViewModeratorLogs(accountRoles);

  const roleLabel = (r: AccountRole) =>
    (adminT as Record<string, string>)[ROLE_DICT_KEYS[r]] ?? r;

  const planLabel = (id: string) => {
    const labels = dict.wallet.plans as Record<string, string>;
    return labels[id] ?? id;
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push(localizedPath(locale, '/login'));
    }
  }, [user, loading, router, locale]);

  useEffect(() => {
    if (!loading && user && !allowed) {
      router.push(localizedPath(locale, '/account'));
    }
  }, [loading, user, allowed, router, locale]);

  const mapTarget = (data: Record<string, unknown>): TargetUser => ({
    email: String(data.email),
    balance: Number(data.balance),
    currency: (data.currency === 'rub' ? 'rub' : 'usd') as Currency,
    role: (data.role as AccountRole) ?? 'user',
    roles: Array.isArray(data.roles) ? (data.roles as AccountRole[]) : ['user'],
    accountFrozen: Boolean(data.accountFrozen),
    balanceFrozen: Boolean(data.balanceFrozen),
    accountFreezeReason: data.accountFreezeReason ? String(data.accountFreezeReason) : null,
    purchases: Array.isArray(data.purchases)
      ? data.purchases.map((p: Record<string, unknown>) => ({
          id: String(p.id),
          licenseKey: String(p.licenseKey),
          planId: String(p.planId),
          amount: Number(p.amount),
          createdAt: String(p.createdAt),
        }))
      : [],
  });

  const handleLookup = async () => {
    setLookupLoading(true);
    setTarget(null);
    try {
      const res = await fetch('/api/moderator/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title:
            data.error === 'not_found'
              ? t.userNotFound
              : data.error === 'protected_role'
                ? t.protectedRole
                : data.error === 'forbidden'
                  ? t.forbidden
                  : t.error,
          variant: 'destructive',
        });
        return;
      }
      setTarget(mapTarget(data));
    } finally {
      setLookupLoading(false);
    }
  };

  const handleFreeze = async (
    patch: Partial<Pick<TargetUser, 'accountFrozen' | 'balanceFrozen'>>,
    reason?: string
  ) => {
    if (!target) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/moderator/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: target.email,
          accountFrozen: patch.accountFrozen ?? target.accountFrozen,
          balanceFrozen: patch.balanceFrozen ?? target.balanceFrozen,
          freezeReason: reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: data.error === 'reason_required' ? t.reasonRequired : t.error,
          variant: 'destructive',
        });
        return;
      }
      setTarget({
        ...target,
        accountFrozen: data.accountFrozen,
        balanceFrozen: data.balanceFrozen,
        accountFreezeReason: data.accountFreezeReason ?? null,
        balance: data.balance ?? target.balance,
      });
      setFreezeDialogOpen(false);
      setFreezeReason('');
      toast({ title: t.freezeUpdated });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccountFreezeClick = () => {
    if (!target) return;
    if (target.accountFrozen) {
      void handleFreeze({ accountFrozen: false });
      return;
    }
    setFreezeReason('');
    setFreezeDialogOpen(true);
  };

  const confirmAccountFreeze = () => {
    if (!freezeReason.trim()) {
      toast({ title: t.reasonRequired, variant: 'destructive' });
      return;
    }
    void handleFreeze({ accountFrozen: true }, freezeReason.trim());
  };

  const handleZeroBalance = async () => {
    if (!target || target.balance <= 0) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/moderator/zero-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: t.error, variant: 'destructive' });
        return;
      }
      setTarget({ ...target, balance: 0 });
      toast({
        title: t.balanceZeroed,
        description: formatMoney(Number(data.zeroed), target.currency),
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    setDeletingId(purchaseId);
    try {
      const res = await fetch('/api/moderator/delete-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId, targetEmail: target?.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: t.error, variant: 'destructive' });
        return;
      }
      setTarget((prev) =>
        prev
          ? { ...prev, purchases: prev.purchases.filter((p) => p.id !== purchaseId) }
          : prev
      );
      toast({ title: t.keyDeleted, description: data.licenseKey });
    } finally {
      setDeletingId(null);
    }
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    toast({ title: dict.wallet.keyCopied });
  };

  if (loading || !user || !allowed) {
    return (
      <div className="container py-20 flex justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container py-12 md:py-16 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" />
          {t.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t.subtitle}</p>
      </div>

      <Card className="mb-6 bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t.findUser}
          </CardTitle>
          <CardDescription>{t.findUserHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mod-email">{t.email}</Label>
            <Input
              id="mod-email"
              type="email"
              placeholder="user@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleLookup}
            disabled={lookupLoading || !email}
          >
            {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.search}
          </Button>
        </CardContent>
      </Card>

      {target && (
        <>
          <Card className="mb-6 bg-card/80 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">{target.email}</CardTitle>
              <CardDescription className="flex flex-wrap gap-2 pt-1">
                {target.roles.map((r) => (
                  <Badge key={r}>{roleLabel(r)}</Badge>
                ))}
                {target.accountFrozen && <Badge variant="destructive">{t.frozenAccount}</Badge>}
                {target.balanceFrozen && <Badge variant="destructive">{t.frozenBalance}</Badge>}
              </CardDescription>
              {target.accountFrozen && target.accountFreezeReason && (
                <p className="text-xs text-muted-foreground border-l-2 border-destructive/50 pl-3 mt-2">
                  {target.accountFreezeReason}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-bold text-primary text-center">
                {formatMoney(target.balance, target.currency)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={target.accountFrozen ? 'default' : 'destructive'}
                  size="sm"
                  disabled={actionLoading}
                  onClick={handleAccountFreezeClick}
                >
                  {target.accountFrozen ? t.unfreezeAccount : t.freezeAccount}
                </Button>
                <Button
                  type="button"
                  variant={target.balanceFrozen ? 'default' : 'destructive'}
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => handleFreeze({ balanceFrozen: !target.balanceFrozen })}
                >
                  {target.balanceFrozen ? t.unfreezeBalance : t.freezeBalance}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="sm:col-span-2"
                  disabled={actionLoading || target.balance <= 0}
                  onClick={handleZeroBalance}
                >
                  {t.zeroBalance}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">{t.noBalanceEdit}</p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                {t.purchasedKeys}
              </CardTitle>
              <CardDescription>{t.purchasedKeysHint}</CardDescription>
            </CardHeader>
            <CardContent>
              {target.purchases.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noKeys}</p>
              ) : (
                <div className="space-y-3">
                  {target.purchases.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-border/60 bg-background/50 p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{planLabel(p.planId)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(p.createdAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                          </p>
                          <p className="text-sm text-primary mt-1">
                            {formatMoney(p.amount, target.currency)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={deletingId === p.id}
                          onClick={() => handleDeletePurchase(p.id)}
                        >
                          {deletingId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded break-all">
                          {p.licenseKey}
                        </code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => copyKey(p.licenseKey)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}



      <div className="mt-8">
        <ModeratorMarketplacePanel />
      </div>

      {showLogs && (
        <div className="mt-8">
          <ModeratorLogsPanel />
        </div>
      )}

      <Dialog open={freezeDialogOpen} onOpenChange={setFreezeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.freezeDialogTitle}</DialogTitle>
            <DialogDescription>{t.freezeDialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="freeze-reason">{t.freezeReasonLabel}</Label>
            <Textarea
              id="freeze-reason"
              value={freezeReason}
              onChange={(e) => setFreezeReason(e.target.value)}
              placeholder={t.freezeReasonPlaceholder}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFreezeDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={actionLoading || !freezeReason.trim()}
              onClick={confirmAccountFreeze}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.confirmFreeze}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}