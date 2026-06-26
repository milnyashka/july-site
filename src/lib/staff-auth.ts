import { isAdminAuthenticated } from '@/lib/admin-auth';
import { canModerateUsers, canAccessAdminPanel } from '@/lib/permissions';
import {
  getPrimaryRole,
  resolveAccountRoles,
  type AccountRole,
} from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';

export type StaffContext = {
  viaAdminCookie: boolean;
  userId: string | null;
  email: string | null;
  roles: AccountRole[];
  role: AccountRole;
};

export async function getStaffContext(): Promise<StaffContext | null> {
  const adminOk = await isAdminAuthenticated();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !adminOk) return null;

  let roles: AccountRole[] = ['user'];
  let email: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, roles, email')
      .eq('id', user.id)
      .maybeSingle();

    roles = resolveAccountRoles(profile?.roles, profile?.role, user);
    email = profile?.email ?? user.email ?? null;
  }

  if (!adminOk && !canModerateUsers(roles) && !canAccessAdminPanel(roles, false)) {
    return null;
  }

  return {
    viaAdminCookie: adminOk,
    userId: user?.id ?? null,
    email: adminOk && !email ? 'admin@panel' : email,
    roles: adminOk ? ['owner', ...roles.filter((r) => r !== 'owner')] : roles,
    role: adminOk ? 'owner' : getPrimaryRole(roles),
  };
}

export async function requireStaff(): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) throw new Error('unauthorized');
  return ctx;
}

export async function requireModerator(): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!ctx.viaAdminCookie && !canModerateUsers(ctx.roles)) {
    throw new Error('forbidden');
  }
  return ctx;
}

export async function requireOwnerAccess(): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!canAccessAdminPanel(ctx.roles, ctx.viaAdminCookie)) {
    throw new Error('forbidden');
  }
  return ctx;
}