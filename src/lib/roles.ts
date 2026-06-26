import type { User } from '@supabase/supabase-js';

/** 1 owner · 2–3 moderator · 4 reseller · 5 user · 6 seller */
export type AccountRole =
  | 'owner'
  | 'moderator'
  | 'moderator_senior'
  | 'reseller'
  | 'user'
  | 'seller';

export const ACCOUNT_ROLES: readonly AccountRole[] = [
  'owner',
  'moderator',
  'moderator_senior',
  'reseller',
  'user',
  'seller',
] as const;

/** Роли, которые выдаёт админ (можно комбинировать) */
export const ASSIGNABLE_ROLES: readonly AccountRole[] = [
  'moderator',
  'moderator_senior',
  'reseller',
  'seller',
  'user',
  'owner',
] as const;

export const ROLE_RANK: Record<AccountRole, number> = {
  owner: 100,
  moderator_senior: 80,
  moderator: 70,
  seller: 50,
  reseller: 40,
  user: 10,
};

const VALID_ROLES = new Set<string>(ACCOUNT_ROLES);

export function isValidRole(role: string | null | undefined): role is AccountRole {
  return typeof role === 'string' && VALID_ROLES.has(role);
}

export function normalizeRoles(
  roles: unknown,
  legacyRole?: string | null
): AccountRole[] {
  let list: AccountRole[] = [];

  if (Array.isArray(roles)) {
    list = roles.filter((r): r is AccountRole => isValidRole(r));
  } else if (typeof roles === 'string' && isValidRole(roles)) {
    list = [roles];
  } else if (legacyRole && isValidRole(legacyRole)) {
    list = [legacyRole];
  }

  const unique = [...new Set(list)];

  if (unique.includes('owner')) {
    return ['owner'];
  }

  if (unique.length === 0) {
    return ['user'];
  }

  if (!unique.includes('user')) {
    unique.push('user');
  }

  return unique;
}

export function getPrimaryRole(roles: AccountRole[]): AccountRole {
  if (roles.length === 0) return 'user';
  return roles.reduce((best, r) => (ROLE_RANK[r] > ROLE_RANK[best] ? r : best), roles[0]);
}

export function resolveAccountRoles(
  profileRoles: string[] | null | undefined,
  profileRole?: string | null,
  user?: User | null
): AccountRole[] {
  if (profileRoles && profileRoles.length > 0) {
    return normalizeRoles(profileRoles);
  }

  const metaRoles = user?.user_metadata?.roles;
  if (Array.isArray(metaRoles) && metaRoles.length > 0) {
    return normalizeRoles(metaRoles);
  }

  const metaRole = user?.user_metadata?.role;
  if (typeof metaRole === 'string') {
    return normalizeRoles(null, metaRole);
  }

  return normalizeRoles(null, profileRole);
}

/** Главная роль (макс. ранг) — для обратной совместимости */
export function resolveAccountRole(
  profileRole: string | null | undefined,
  user?: User | null,
  profileRoles?: string[] | null
): AccountRole {
  return getPrimaryRole(resolveAccountRoles(profileRoles, profileRole, user));
}

export function toRoleArray(
  input: AccountRole | AccountRole[] | string | null | undefined
): AccountRole[] {
  if (Array.isArray(input)) return normalizeRoles(input);
  if (typeof input === 'string' && isValidRole(input)) return normalizeRoles([input]);
  return ['user'];
}

export function hasRole(
  roles: AccountRole | AccountRole[] | string | null | undefined,
  role: AccountRole
): boolean {
  return toRoleArray(roles).includes(role);
}

export function isReseller(roles: AccountRole | AccountRole[] | string | null | undefined): boolean {
  return hasRole(roles, 'reseller');
}

export function isSeller(roles: AccountRole | AccountRole[] | string | null | undefined): boolean {
  return hasRole(roles, 'seller');
}

export function isModerator(roles: AccountRole | AccountRole[] | string | null | undefined): boolean {
  return hasRole(roles, 'moderator') || hasRole(roles, 'moderator_senior');
}

export function isSeniorModerator(roles: AccountRole | AccountRole[] | string | null | undefined): boolean {
  return hasRole(roles, 'moderator_senior');
}

export function isOwner(roles: AccountRole | AccountRole[] | string | null | undefined): boolean {
  return hasRole(roles, 'owner');
}

export function isStaff(roles: AccountRole | AccountRole[] | string | null | undefined): boolean {
  return isOwner(roles) || isModerator(roles);
}

export function rolesOverlap(
  roles: AccountRole[],
  targets: readonly AccountRole[]
): boolean {
  return targets.some((t) => roles.includes(t));
}

export function normalizeRole(role: string | null | undefined): AccountRole {
  return isValidRole(role) ? role : 'user';
}