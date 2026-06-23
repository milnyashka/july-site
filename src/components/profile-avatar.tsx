'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth-provider';
import { useI18n } from '@/i18n/I18nProvider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type ProfileAvatarProps = {
  size?: 'sm' | 'lg';
  editable?: boolean;
  className?: string;
};

function initialsFromEmail(email?: string) {
  if (!email) return '?';
  const local = email.split('@')[0] ?? '';
  return (local.slice(0, 2) || email.slice(0, 2)).toUpperCase();
}

export function ProfileAvatar({ size = 'lg', editable = false, className }: ProfileAvatarProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { dict } = useI18n();
  const t = dict.wallet;
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const dimension = size === 'lg' ? 'h-24 w-24' : 'h-9 w-9';
  const iconSize = size === 'lg' ? 'h-10 w-10' : 'h-4 w-4';

  const handleFile = async (file: File) => {
    if (!user) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: t.avatarInvalidType, variant: 'destructive' });
      return;
    }

    if (file.size > MAX_SIZE) {
      toast({ title: t.avatarTooLarge, variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      toast({ title: t.avatarUpdated });
    } catch {
      toast({ title: t.avatarUploadFailed, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={cn('relative inline-flex', className)}>
      <Avatar className={dimension}>
        <AvatarImage src={profile?.avatarUrl ?? undefined} alt={profile?.email ?? ''} />
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
          {profile?.email ? (
            <span className={size === 'lg' ? 'text-xl' : 'text-xs'}>
              {initialsFromEmail(profile.email)}
            </span>
          ) : (
            <User className={iconSize} />
          )}
        </AvatarFallback>
      </Avatar>

      {editable && user && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className={cn(
              'absolute -bottom-1 -right-1 rounded-full shadow-md',
              size === 'lg' ? 'h-8 w-8' : 'h-6 w-6'
            )}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </Button>
        </>
      )}
    </div>
  );
}