import type { AccountRole } from '@/lib/roles';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ModeratorAction =
  | 'freeze_account'
  | 'unfreeze_account'
  | 'freeze_balance'
  | 'unfreeze_balance'
  | 'zero_balance'
  | 'delete_purchase';

export type ModeratorLogRow = {
  id: string;
  actorId: string | null;
  actorEmail: string;
  actorRoles: AccountRole[];
  action: ModeratorAction;
  targetEmail: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

type WriteLogInput = {
  actorId: string | null;
  actorEmail: string;
  actorRoles: AccountRole[];
  action: ModeratorAction;
  targetEmail?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown>;
};

export async function writeModeratorLog(
  service: SupabaseClient,
  input: WriteLogInput
): Promise<void> {
  const { error } = await service.from('moderator_logs').insert({
    actor_id: input.actorId,
    actor_email: input.actorEmail,
    actor_roles: input.actorRoles,
    action: input.action,
    target_email: input.targetEmail ?? null,
    target_id: input.targetId ?? null,
    details: input.details ?? {},
  });

  if (error) {
    console.error('moderator_log insert failed:', error.message);
  }
}

export function mapLogRow(row: Record<string, unknown>): ModeratorLogRow {
  return {
    id: String(row.id),
    actorId: row.actor_id ? String(row.actor_id) : null,
    actorEmail: String(row.actor_email),
    actorRoles: Array.isArray(row.actor_roles)
      ? (row.actor_roles as string[]).filter(Boolean) as AccountRole[]
      : [],
    action: row.action as ModeratorAction,
    targetEmail: row.target_email ? String(row.target_email) : null,
    targetId: row.target_id ? String(row.target_id) : null,
    details: (row.details as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}