'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
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
  if (lower.includes('password') && lower.includes('least')) return t.authErrors.passwordWeak;
  return message;
}

export default function ResetPasswordPage() {
  const { locale, dict } = useI18n();
  const t = dict.auth;
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionInvalid, setSessionInvalid] = useState(false);

  const accountPath = localizedPath(locale, '/account');
  const forgotPath = localizedPath(locale, '/forgot-password');

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSessionInvalid(true);
      return;
    }

    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      } else {
        setSessionInvalid(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      router.replace(accountPath);
      router.refresh();
    }, 2000);
    return () => clearTimeout(timer);
  }, [success, router, accountPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError(t.passwordMismatch);
      return;
    }

    setLoading(true);

    if (!isSupabaseConfigured()) {
      setError(t.supabaseNotConfigured);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.updateUser({ password });

    if (authError) {
      setError(translateAuthError(authError.message, t));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (!sessionReady && !sessionInvalid) {
    return (
      <div className="container py-20 text-center text-muted-foreground">
        {dict.wallet.loading}
      </div>
    );
  }

  if (sessionInvalid) {
    return (
      <div className="container flex items-center justify-center py-16 md:py-24">
        <Card className="w-full max-w-md bg-card/80 border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-headline">{t.resetPasswordTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-destructive">{t.resetLinkInvalid}</p>
            <Link href={forgotPath}>
              <Button className="w-full">{t.forgotPasswordTitle}</Button>
            </Link>
            <Link href={localizedPath(locale, '/login')} className="text-sm text-primary hover:underline">
              {t.backToLogin}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container flex items-center justify-center py-16 md:py-24">
      <Card className="w-full max-w-md bg-card/80 border-border/50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">{t.resetPasswordTitle}</CardTitle>
          <CardDescription>{t.resetPasswordDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <p className="text-center text-sm text-green-400">{t.passwordResetSuccess}</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t.newPassword}</Label>
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
              <div className="space-y-2">
                <Label htmlFor="confirm">{t.confirmPassword}</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <p className="text-xs text-muted-foreground">{t.passwordHint}</p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t.savePassword}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}