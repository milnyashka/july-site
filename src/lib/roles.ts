import type { User } from '@supabase/supabase-js';

export type AccountRole = 'user' | 'reseller';

export function isReseller(role: AccountRole | string | null | undefined): boolean {
  return role === 'reseller';
}

export function normalizeRole(role: string | null | undefined): AccountRole {
  return role === 'reseller' ? 'reseller' : 'user';
}

export function resolveAccountRole(
  profileRole: string | null | undefined,
  user?: User | null
): AccountRole {
  if (profileRole === 'reseller') return 'reseller';
  const metaRole = user?.user_metadata?.role;
  if (typeof metaRole === 'string' && metaRole === 'reseller') return 'reseller';
  return normalizeRole(profileRole ?? (typeof metaRole === 'string' ? metaRole : undefined));
}