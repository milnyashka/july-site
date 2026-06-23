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
  if (lower.includes('invalid') && lower.includes('email')) return t.authErrors.invalidEmail;
  return message;
}

export default function ForgotPasswordPage() {
  const { locale, dict } = useI18n();
  const t = dict.auth;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const accountPath = localizedPath(locale, '/account');
  const loginPath = localizedPath(locale, '/login');

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(accountPath);
    }
  }, [authLoading, user, router, accountPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    if (!isSupabaseConfigured()) {
      setError(t.supabaseNotConfigured);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const resetPath = localizedPath(locale, '/reset-password');
    const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(resetPath)}`;

    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      email.toLowerCase().trim(),
      { redirectTo }
    );

    if (authError) {
      setError(translateAuthError(authError.message, t));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
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
          <CardTitle className="text-2xl font-headline">{t.forgotPasswordTitle}</CardTitle>
          <CardDescription>{t.forgotPasswordDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-green-400">{t.resetLinkSent}</p>
              <Link href={loginPath}>
                <Button variant="outline" className="w-full">
                  {t.backToLogin}
                </Button>
              </Link>
            </div>
          ) : (
            <>
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
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t.sendResetLink}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                <Link href={loginPath} className="text-primary hover:underline">
                  {t.backToLogin}
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}