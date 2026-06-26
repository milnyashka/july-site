'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Lock, LogOut, Check, X, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/lib/currency';
import { maskDestination, type WithdrawalRequest } from '@/lib/withdrawals';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { useToast } from '@/hooks/use-toast';

export default function AdminWithdrawalsPage() {
  const { locale, dict } = useI18n();
  const t = dict.adminWithdrawals;
  const a = dict.admin;
  const { toast } = useToast();

  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [serviceReady, setServiceReady] = useState(true);

  const checkAuth = useCallback(async () => {
    const res = await fetch('/api/admin/me');
    const data = await res.json();
    setAuthenticated(data.authenticated);
    setChecking(false);
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals?status=${filter}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequests(data.requests ?? []);
    } catch {
      toast({ title: t.loadError, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filter, toast, t.loadError]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!authenticated) return;
    fetch('/api/admin/status')
      .then((r) => r.json())
      .then((d) => setServiceReady(Boolean(d.serviceConfigured)))
      .catch(() => setServiceReady(false));
    loadRequests();
  }, [authenticated, loadRequests]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setAuthenticated(true);
        setPassword('');
      } else {
        toast({ title: a.wrongPassword, variant: 'destructive' });
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
  };

  const processRequest = async (id: string, action: 'completed' | 'rejected', adminNote?: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: action === 'completed' ? t.completed : t.rejected });
      await loadRequests();
    } catch {
      toast({ title: t.processError, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  if (checking) {
    return (
      <div className="container py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="container py-20 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {t.loginTitle}
            </CardTitle>
            <CardDescription>{t.loginDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{a.password}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {a.login}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusLabel = (s: string) => (t.statuses as Record<string, string>)[s] ?? s;

  return (
    <div className="container py-12 md:py-20 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <Link
            href={localizedPath(locale, '/admin')}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t.backToAdmin}
          </Link>
          <h1 className="text-3xl font-bold font-headline">{t.title}</h1>
          <p className="text-muted-foreground mt-1">{t.subtitle}</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          {a.logout}
        </Button>
      </div>

      {!serviceReady && (
        <div className="mb-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-200">
          {a.serviceNotConfigured}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <Button
          size="sm"
          variant={filter === 'pending' ? 'default' : 'outline'}
          onClick={() => setFilter('pending')}
        >
          {t.filterPending}
        </Button>
        <Button
          size="sm"
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          {t.filterAll}
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t.loading}</p>
      ) : requests.length === 0 ? (
        <p className="text-muted-foreground">{t.empty}</p>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold">{req.userEmail ?? req.userId}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(req.createdAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <Badge variant={req.status === 'pending' ? 'default' : 'secondary'}>
                    {statusLabel(req.status)}
                  </Badge>
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">{t.method}: </span>
                    {req.method === 'crypto' ? t.methodCrypto : t.methodCard}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t.destination}: </span>
                    <span className="font-mono">{maskDestination(req.method, req.destination)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t.amount}: </span>
                    {formatMoney(req.amount, req.currency)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t.fee}: </span>
                    {formatMoney(req.fee, req.currency)}
                  </div>
                  <div className="sm:col-span-2 font-semibold text-primary">
                    {t.payout}: {formatMoney(req.netAmount, req.currency)}
                  </div>
                </div>

                {req.status === 'pending' && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      disabled={processingId === req.id}
                      onClick={() => processRequest(req.id, 'completed')}
                    >
                      {processingId === req.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      {t.markPaid}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={processingId === req.id}
                      onClick={() => processRequest(req.id, 'rejected', t.rejectNote)}
                    >
                      <X className="mr-2 h-4 w-4" />
                      {t.reject}
                    </Button>
                    <details className="w-full text-xs text-muted-foreground">
                      <summary className="cursor-pointer">{t.showFullDest}</summary>
                      <p className="font-mono mt-1 break-all">{req.destination}</p>
                    </details>
                  </div>
                )}

                {req.adminNote && (
                  <p className="text-xs text-muted-foreground">{req.adminNote}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}