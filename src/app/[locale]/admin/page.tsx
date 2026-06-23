'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Lock, LogOut, Search, Wallet, BadgePercent } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AccountRole } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney, type Currency } from '@/lib/currency';
import { useI18n } from '@/i18n/I18nProvider';
import { useToast } from '@/hooks/use-toast';

type UserInfo = {
  email: string;
  balance: number;
  currency: Currency;
  role: AccountRole;
};

export default function AdminPage() {
  const { dict } = useI18n();
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
  const [lookupLoading, setLookupLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [serviceReady, setServiceReady] = useState(true);

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
  }, [authenticated]);

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

  const handleLookup = async () => {
    setLookupLoading(true);
    setUser(null);
    try {
      const res = await fetch('/api/admin/lookup', {
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
              : data.error === 'service_not_configured'
                ? t.serviceNotConfigured
                : t.error,
          variant: 'destructive',
        });
        return;
      }
      setUser({
        email: data.email,
        balance: data.balance,
        currency: data.currency,
        role: data.role === 'reseller' ? 'reseller' : 'user',
      });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSetRole = async (role: AccountRole) => {
    if (!email) return;
    setRoleLoading(true);
    try {
      const res = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
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
      setUser({
        email: data.email,
        balance: data.balance,
        currency: data.currency,
        role: data.role,
      });
      toast({
        title: role === 'reseller' ? t.resellerGranted : t.resellerRevoked,
        description: data.email,
      });
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
      setUser({
        email: data.email,
        balance: data.balance,
        currency,
        role: user?.role ?? 'user',
      });
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

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-headline">{t.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          {t.logout}
        </Button>
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
            {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.checkBalance}
          </Button>
          {user && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-2xl font-bold text-primary">
                {formatMoney(user.balance, user.currency)}
              </p>
              <Badge variant={user.role === 'reseller' ? 'default' : 'secondary'}>
                {user.role === 'reseller' ? t.roleReseller : t.roleUser}
              </Badge>
              <div className="flex gap-2">
                {user.role === 'reseller' ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={roleLoading}
                    onClick={() => handleSetRole('user')}
                  >
                    {roleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.revokeReseller}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={roleLoading}
                    onClick={() => handleSetRole('reseller')}
                  >
                    {roleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <BadgePercent className="mr-2 h-4 w-4" />
                        {t.grantReseller}
                      </>
                    )}
                  </Button>
                )}
              </div>
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
    </div>
  );
}