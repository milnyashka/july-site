'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Lock, LogOut, Search, Wallet, BadgePercent } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ASSIGNABLE_ROLES, normalizeRoles, type AccountRole } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ModeratorLogsPanel } from '@/components/moderator-logs-panel';
import { formatMoney, type Currency } from '@/lib/currency';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { useToast } from '@/hooks/use-toast';

type UserInfo = {
  email: string;
  balance: number;
  currency: Currency;
  role: AccountRole;
  roles: AccountRole[];
  accountFrozen: boolean;
  balanceFrozen: boolean;
};

const ROLE_DICT_KEYS: Record<AccountRole, keyof typeof import('@/i18n/dictionaries/ru').ru.admin> = {
  owner: 'roleOwner',
  moderator: 'roleModerator',
  moderator_senior: 'roleModeratorSenior',
  reseller: 'roleReseller',
  user: 'roleUser',
  seller: 'roleSeller',
};

export default function AdminPage() {
  const { locale, dict } = useI18n();
  const t = dict.admin;
  const { toast } = useToast();

  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [user, setUser] = useState<UserInfo | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<AccountRole[]>(['user']);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [serviceReady, setServiceReady] = useState(true);

  type PromoItem = {
    id: string;
    code: string;
    ownerEmail: string;
    discountPercent: number;
    commissionPercent: number;
    maxDiscountedPurchases: number;
    referredCount: number;
    totalEarned: number;
    createdAt: string;
  };

  const [promocodes, setPromocodes] = useState<PromoItem[]>([]);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoOwnerEmailInput, setPromoOwnerEmailInput] = useState('');
  const [createPromoLoading, setCreatePromoLoading] = useState(false);

  const roleLabel = (role: AccountRole) => {
    const key = ROLE_DICT_KEYS[role];
    return (t as Record<string, string>)[key] ?? role;
  };

  const loadPromocodes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/promocodes');
      if (res.ok) {
        const data = await res.json();
        setPromocodes(data.promocodes ?? []);
      }
    } catch {}
  }, []);

  const checkAuth = useCallback(async () => {
    const res = await fetch('/api/admin/me');
    const data = await res.json();
    setAuthenticated(data.authenticated);
    setChecking(false);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!authenticated) return;
    fetch('/api/admin/status')
      .then((r) => r.json())
      .then((d) => setServiceReady(Boolean(d.serviceConfigured)))
      .catch(() => setServiceReady(false));
    loadPromocodes();
  }, [authenticated, loadPromocodes]);

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatePromoLoading(true);
    try {
      const res = await fetch('/api/admin/promocodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCodeInput, ownerEmail: promoOwnerEmailInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title:
            data.error === 'user_not_found'
              ? (locale === 'ru' ? 'Пользователь не найден' : 'User not found')
              : data.error === 'code_exists'
                ? (locale === 'ru' ? 'Промокод уже существует' : 'Promo code already exists')
                : (locale === 'ru' ? 'Ошибка создания' : 'Creation error'),
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: locale === 'ru' ? 'Промокод успешно создан!' : 'Promo code created!',
        description: `${data.promocode.code} -> ${data.promocode.ownerEmail}`,
      });
      setPromoCodeInput('');
      setPromoOwnerEmailInput('');
      loadPromocodes();
    } finally {
      setCreatePromoLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        toast({ title: t.wrongPassword, variant: 'destructive' });
        return;
      }
      setAuthenticated(true);
      setPassword('');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
    setUser(null);
  };

  const mapUser = (data: Record<string, unknown>): UserInfo => ({
    email: String(data.email),
    balance: Number(data.balance),
    currency: (data.currency === 'rub' ? 'rub' : 'usd') as Currency,
    role: (data.role as AccountRole) ?? 'user',
    roles: normalizeRoles(data.roles, data.role as string),
    accountFrozen: Boolean(data.accountFrozen),
    balanceFrozen: Boolean(data.balanceFrozen),
  });

  const toggleRole = (role: AccountRole, checked: boolean) => {
    setSelectedRoles((prev) => {
      if (role === 'owner') {
        return checked ? ['owner'] : ['user'];
      }
      let next = checked ? [...prev.filter((r) => r !== 'owner'), role] : prev.filter((r) => r !== role);
      if (role !== 'user' && !checked && next.length === 0) {
        next = ['user'];
      }
      if (!next.includes('user') && !next.includes('owner')) {
        next = [...next, 'user'];
      }
      return normalizeRoles(next);
    });
  };

  const rolesEqual = (a: AccountRole[], b: AccountRole[]) => {
    const sa = [...a].sort().join(',');
    const sb = [...b].sort().join(',');
    return sa === sb;
  };

  const handleLookup = async () => {
    setLookupLoading(true);
    setUser(null);
    try {
      const res = await fetch('/api/admin/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title:
            data.error === 'not_found'
              ? t.userNotFound
              : data.error === 'service_not_configured'
                ? t.serviceNotConfigured
                : t.error,
          variant: 'destructive',
        });
        return;
      }
      const mapped = mapUser(data);
      setUser(mapped);
      setSelectedRoles(mapped.roles);
      if (data.email) setEmail(String(data.email));
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSetRole = async () => {
    if (!email) return;
    setRoleLoading(true);
    try {
      const res = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, roles: selectedRoles }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title:
            data.error === 'not_found'
              ? t.userNotFound
              : data.error === 'service_not_configured'
                ? t.serviceNotConfigured
                : t.error,
          variant: 'destructive',
        });
        return;
      }
      setUser(mapUser(data));
      const labels = selectedRoles.map(roleLabel).join(' + ');
      toast({ title: t.roleUpdated, description: `${data.email} → ${labels}` });
    } finally {
      setRoleLoading(false);
    }
  };

  const handleAddBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      const res = await fetch('/api/admin/add-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, amount: parseFloat(amount), note }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title:
            data.error === 'not_found'
              ? t.userNotFound
              : data.error === 'service_not_configured'
                ? t.serviceNotConfigured
                : t.error,
          variant: 'destructive',
        });
        return;
      }
      const currency = data.currency as Currency;
      setUser((prev) =>
        prev
          ? { ...prev, email: data.email, balance: data.balance, currency }
          : {
              email: data.email,
              balance: data.balance,
              currency,
              role: 'user',
              roles: ['user'],
              accountFrozen: false,
              balanceFrozen: false,
            }
      );
      setAmount('');
      toast({
        title: t.success,
        description: t.successDetail
          .replace('{amount}', formatMoney(data.added, currency))
          .replace('{balance}', formatMoney(data.balance, currency)),
      });
    } finally {
      setAddLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="container py-20 flex justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="container flex items-center justify-center py-16 md:py-24">
        <Card className="w-full max-w-md bg-card/80 border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="font-headline">{t.loginTitle}</CardTitle>
            <CardDescription>{t.loginDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-password">{t.password}</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t.login}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-12 md:py-16 max-w-lg">
      {!serviceReady && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {t.serviceNotConfigured}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-headline">{t.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            {t.logout}
          </Button>
        </div>
      </div>

      <Card className="mb-6 bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t.findUser}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t.email}</Label>
            <Input
              id="email"
              type="text"
              placeholder="user@email.com or TraderName"
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
            {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.checkBalance}
          </Button>
          {user && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-2xl font-bold text-primary">
                {formatMoney(user.balance, user.currency)}
              </p>
              <div className="flex flex-wrap justify-center gap-1">
                {user.roles.map((r) => (
                  <Badge key={r} variant="default">{roleLabel(r)}</Badge>
                ))}
              </div>
              {(user.accountFrozen || user.balanceFrozen) && (
                <div className="flex flex-wrap justify-center gap-1">
                  {user.accountFrozen && <Badge variant="destructive">{t.frozenAccount}</Badge>}
                  {user.balanceFrozen && <Badge variant="destructive">{t.frozenBalance}</Badge>}
                </div>
              )}
              <div className="space-y-3 text-left">
                <Label>{t.setRoles}</Label>
                <p className="text-xs text-muted-foreground">{t.setRolesHint}</p>
                <div className="grid grid-cols-1 gap-2">
                  {ASSIGNABLE_ROLES.map((r) => (
                    <label
                      key={r}
                      className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-2 cursor-pointer hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={selectedRoles.includes(r)}
                        disabled={selectedRoles.includes('owner') && r !== 'owner'}
                        onCheckedChange={(v) => toggleRole(r, v === true)}
                      />
                      <span className="text-sm">{roleLabel(r)}</span>
                    </label>
                  ))}
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={roleLoading || rolesEqual(selectedRoles, user.roles)}
                  onClick={handleSetRole}
                >
                  {roleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <BadgePercent className="mr-2 h-4 w-4" />
                      {t.saveRoles}
                    </>
                  )}
                </Button>
              </div>
              {(selectedRoles.includes('moderator') || selectedRoles.includes('moderator_senior')) && (
                <p className="text-xs text-muted-foreground text-left pt-2 border-t border-border/50">
                  {t.moderatorRoleHint}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t.addBalance}
          </CardTitle>
          <CardDescription>{t.addBalanceHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddBalance} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-email">{t.email}</Label>
              <Input
                id="add-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-amount">{t.amount}</Label>
              <Input
                id="add-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="10.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">{t.note}</Label>
              <Input
                id="note"
                placeholder={t.notePlaceholder}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={addLoading || !email || !amount}>
              {addLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t.confirmAdd}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BadgePercent className="h-5 w-5" />
            {locale === 'ru' ? 'Реферальные промокоды (15% скидка / 15% доход)' : 'Referral Promo Codes (15% discount / 15% earn)'}
          </CardTitle>
          <CardDescription>
            {locale === 'ru'
              ? 'Создайте персональный промокод для стримера/партнера. Новый юзер получит 15% скидку на 3 покупки, а партнер — 15% с каждой покупки на свой баланс.'
              : 'Create a personal promo code for a partner. New user gets 15% off first 3 purchases, partner gets 15% from every purchase.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleCreatePromo} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="promo-code">{locale === 'ru' ? 'Промокод' : 'Promo Code'}</Label>
                <Input
                  id="promo-code"
                  type="text"
                  placeholder="JULY2026"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promo-owner">{locale === 'ru' ? 'Email владельца' : 'Owner Email'}</Label>
                <Input
                  id="promo-owner"
                  type="email"
                  placeholder="partner@gmail.com"
                  value={promoOwnerEmailInput}
                  onChange={(e) => setPromoOwnerEmailInput(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createPromoLoading || !promoCodeInput || !promoOwnerEmailInput}>
              {createPromoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {locale === 'ru' ? 'Создать реферальный промокод' : 'Create Referral Promo Code'}
            </Button>
          </form>

          {promocodes.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border/50">
              <h4 className="font-semibold text-sm">
                {locale === 'ru' ? 'Активные реферальные промокоды:' : 'Active Referral Promo Codes:'}
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {promocodes.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-border/50 bg-muted/20 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-primary text-sm mr-2">{item.code}</span>
                      <span className="text-muted-foreground">({item.ownerEmail})</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                      <span>👥 {locale === 'ru' ? 'Привлечено:' : 'Referred:'} <strong className="text-foreground">{item.referredCount}</strong></span>
                      <span>💰 {locale === 'ru' ? 'Заработано:' : 'Earned:'} <strong className="text-emerald-400">${item.totalEarned.toFixed(2)}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8">
        <ModeratorLogsPanel />
      </div>
    </div>
  );
}