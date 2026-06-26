'use client';

import { useEffect, useState } from 'react';
import { Loader2, Lock, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { USERNAME_MAX, USERNAME_MIN } from '@/lib/username';
import { useAuth } from '@/components/auth-provider';
import { useI18n } from '@/i18n/I18nProvider';
import { useToast } from '@/hooks/use-toast';

export function UsernameEditor() {
  const { profile, refreshProfile } = useAuth();
  const { dict } = useI18n();
  const t = dict.wallet;
  const { toast } = useToast();

  const [value, setValue] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(profile?.username ?? '');
  }, [profile?.username]);

  if (profile?.username) {
    return (
      <Card className="mb-6 bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCircle className="h-5 w-5 text-primary" />
            {t.usernameTitle}
          </CardTitle>
          <CardDescription>{t.usernameLocked}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3">
            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-semibold">{profile.username}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: value }),
      });
      const data = await res.json();

      if (!res.ok) {
        const key = data.error as keyof typeof t.usernameErrors;
        toast({
          title: t.usernameErrors[key] ?? t.usernameSaveFailed,
          variant: 'destructive',
        });
        return;
      }

      await refreshProfile();
      toast({ title: t.usernameSaved });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-6 bg-card/80 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserCircle className="h-5 w-5 text-primary" />
          {t.usernameTitle}
        </CardTitle>
        <CardDescription>{t.usernameHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="username">{t.usernameLabel}</Label>
          <Input
            id="username"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, USERNAME_MAX))}
            placeholder={t.usernamePlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            {t.usernameRules.replace('{min}', String(USERNAME_MIN)).replace('{max}', String(USERNAME_MAX))}
          </p>
          <p className="text-xs text-amber-400/90">{t.usernamePermanent}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={saving || value.length < USERNAME_MIN}
          onClick={handleSave}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.usernameSave}
        </Button>
      </CardContent>
    </Card>
  );
}