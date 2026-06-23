'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  if (lower.includes('rate limit') || lower.includes('over_email')) return t.authErrors.rateLimit;
  if (lower.includes('already registered') || lower.includes('already been registered')) return t.authErrors.alreadyRegistered;
  if (lower.includes('password') && lower.includes('least')) return t.authErrors.passwordWeak;
  if (lower.includes('invalid') && lower.includes('email')) return t.authErrors.invalidEmail;
  return message;
}

export default function RegisterPage() {
  const { locale, dict } = useI18n();
  const t = dict.auth;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const accountPath = localizedPath(locale, '/account');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(accountPath);
    }
  }, [authLoading, user, router, accountPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!isSupabaseConfigured()) {
      setError(t.supabaseNotConfigured);
      setLoading(false);
      return;
    }

    let supabase;
    try {
      supabase = createClient();
    } catch {
      setError(t.supabaseNotConfigured);
      setLoading(false);
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { data, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${localizedPath(locale, '/account')}`,
        data: { currency: locale === 'ru' ? 'rub' : 'usd' },
      },
    });

    if (authError) {
      setError(translateAuthError(authError.message, t));
      setLoading(false);
      return;
    }

    if (!data.session) {
      router.push(`${localizedPath(locale, '/login')}?registered=1`);
      return;
    }

    router.replace(accountPath);
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
          <CardTitle className="text-2xl font-headline">{t.registerTitle}</CardTitle>
          <CardDescription>{t.registerDescription}</CardDescription>
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
              <Label htmlFor="password">{t.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t.passwordHint}</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-400">{success}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.createAccount}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t.hasAccount}{' '}
            <Link href={localizedPath(locale, '/login')} className="text-primary hover:underline">
              {t.login}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}