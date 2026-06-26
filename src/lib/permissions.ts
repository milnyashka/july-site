import {
  type AccountRole,
  ASSIGNABLE_ROLES,
  isModerator,
  isOwner,
  isSeniorModerator,
  isValidRole,
  rolesOverlap,
  toRoleArray,
  ROLE_RANK,
} from '@/lib/roles';

export const MODERATOR_PROTECTED_ROLES: readonly AccountRole[] = [
  'owner',
  'moderator',
  'moderator_senior',
];

export type Permission =
  | 'full_access'
  | 'manage_all_roles'
  | 'manage_balance'
  | 'moderate_users'
  | 'freeze_user_balance'
  | 'freeze_user_account'
  | 'zero_user_balance'
  | 'view_user_keys'
  | 'delete_user_keys'
  | 'view_moderator_logs'
  | 'view_all_moderator_logs'
  | 'reseller_pricing'
  | 'marketplace_sell'
  | 'marketplace_buy'
  | 'moderate_marketplace';

const ROLE_PERMISSIONS: Record<AccountRole, readonly Permission[]> = {
  owner: [
    'full_access',
    'manage_all_roles',
    'manage_balance',
    'moderate_users',
    'freeze_user_balance',
    'freeze_user_account',
    'zero_user_balance',
    'view_user_keys',
    'delete_user_keys',
    'view_moderator_logs',
    'view_all_moderator_logs',
    'reseller_pricing',
    'marketplace_sell',
    'marketplace_buy',
    'moderate_marketplace',
  ],
  moderator_senior: [
    'moderate_users',
    'freeze_user_balance',
    'freeze_user_account',
    'zero_user_balance',
    'view_user_keys',
    'delete_user_keys',
    'view_moderator_logs',
    'marketplace_sell',
    'marketplace_buy',
    'moderate_marketplace',
  ],
  moderator: [
    'moderate_users',
    'freeze_user_balance',
    'freeze_user_account',
    'zero_user_balance',
    'view_user_keys',
    'delete_user_keys',
    'marketplace_sell',
    'marketplace_buy',
    'moderate_marketplace',
  ],
  reseller: ['reseller_pricing', 'marketplace_sell', 'marketplace_buy'],
  seller: ['marketplace_sell', 'marketplace_buy'],
  user: ['marketplace_sell', 'marketplace_buy'],
};

export function getPermissions(role: AccountRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function getEffectivePermissions(
  roles: AccountRole | AccountRole[] | string | null | undefined
): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of toRoleArray(roles)) {
    for (const perm of ROLE_PERMISSIONS[role]) {
      set.add(perm);
    }
  }
  return set;
}

export function hasPermission(
  roles: AccountRole | AccountRole[] | string | null | undefined,
  permission: Permission
): boolean {
  return getEffectivePermissions(roles).has(permission);
}

export function canModerateUsers(roles: AccountRole | AccountRole[] | string | null | undefined): boolean {
  return hasPermission(roles, 'moderate_users');
}

export function canModerateTarget(
  targetRoles: AccountRole | AccountRole[] | string | null | undefined
): boolean {
  const list = toRoleArray(targetRoles);
  return !rolesOverlap(list, MODERATOR_PROTECTED_ROLES);
}

export function canViewModeratorLogs(
  roles: AccountRole | AccountRole[] | string | null | undefined,
  viaAdminCookie = false
): boolean {
  if (viaAdminCookie) return true;
  return hasPermission(roles, 'view_moderator_logs') || hasPermission(roles, 'view_all_moderator_logs');
}

export function canViewAllModeratorLogs(
  roles: AccountRole | AccountRole[] | string | null | undefined,
  viaAdminCookie = false
): boolean {
  if (viaAdminCookie) return true;
  return hasPermission(roles, 'view_all_moderator_logs');
}

export function canAssignRole(
  actorRoles: AccountRole | AccountRole[] | string | null | undefined,
  _targetRole: AccountRole
): boolean {
  return isOwner(actorRoles);
}

export function assignableRoles(): AccountRole[] {
  return [...ASSIGNABLE_ROLES];
}

export function canAccessModeratorPanel(roles: AccountRole | AccountRole[] | string | null | undefined): boolean {
  return canModerateUsers(roles);
}

export function canModerateMarketplace(
  roles: AccountRole | AccountRole[] | string | null | undefined
): boolean {
  return hasPermission(roles, 'moderate_marketplace');
}

export function canAccessAdminPanel(
  roles: AccountRole | AccountRole[] | string | null | undefined,
  adminCookieOk: boolean
): boolean {
  if (adminCookieOk) return true;
  return isOwner(roles);
}

export function outranks(
  actor: AccountRole | AccountRole[],
  target: AccountRole
): boolean {
  const actorPrimary = Array.isArray(actor)
    ? actor.reduce((b, r) => (ROLE_RANK[r] > ROLE_RANK[b] ? r : b), actor[0])
    : actor;
  if (!isValidRole(actorPrimary)) return false;
  return ROLE_RANK[actorPrimary] > ROLE_RANK[target];
}

export function isOnlyModerator(roles: AccountRole[]): boolean {
  return isModerator(roles) && !isSeniorModerator(roles) && !isOwner(roles);
}