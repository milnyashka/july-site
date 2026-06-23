'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { Loader2 } from 'lucide-react';

function translateAuthError(message: string, t: { authErrors: Record<string, string> }) {
  const lower = message.toLowerCase();
  if (lower.includes('email not confirmed') || lower.includes('not confirmed')) return t.authErrors.emailNotConfirmed;
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) return t.authErrors.invalidOrUnconfirmed;
  if (lower.includes('rate limit')) return t.authErrors.rateLimit;
  return message;
}

export default function LoginPage() {
  const { locale, dict } = useI18n();
  const t = dict.auth;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);

  const accountPath = localizedPath(locale, '/account');

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(accountPath);
    }
  }, [authLoading, user, router, accountPath]);

  useEffect(() => {
    if (searchParams.get('registered') === '1') {
      setHint(t.confirmEmail);
    }
  }, [searchParams, t.confirmEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setHint('');

    if (!isSupabaseConfigured()) {
      setError(t.supabaseNotConfigured);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (authError) {
      const friendly = translateAuthError(authError.message, t);
      setError(friendly);
      if (friendly !== authError.message) {
        setHint(`${t.technicalError}: ${authError.message}`);
      }
      setLoading(false);
      return;
    }

    const next = searchParams.get('next');
    const destination =
      next && next.startsWith('/') && !next.startsWith('//') ? next : accountPath;

    router.replace(destination);
    router.refresh();
  };

  if (authLoading || user) {
    return (
      <div className="container py-20 text-center text-muted-foreground">
        {dict.wallet.loading}
      </div>
    );
  }

  return (
    <div className="container flex items-center justify-center py-16 md:py-24">
      <Card className="w-full max-w-md bg-card/80 border-border/50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">{t.loginTitle}</CardTitle>
          <CardDescription>{t.loginDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.email}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t.password}</Label>
                <Link
                  href={localizedPath(locale, '/forgot-password')}
                  className="text-xs text-primary hover:underline"
                >
                  {t.forgotPassword}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {hint && !error && <p className="text-sm text-green-400">{hint}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {hint && error && <p className="text-xs text-muted-foreground">{hint}</p>}
            <p className="text-xs text-muted-foreground">{t.loginHint}</p>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.login}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t.noAccount}{' '}
            <Link href={localizedPath(locale, '/register')} className="text-primary hover:underline">
              {t.register}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}