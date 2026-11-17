import { supabase } from '../../shared/supabase';
import { friendlyRpcError } from '../../shared/utils/rpcError';

export type ActivityEntity =
  | 'session' | 'participant' | 'payment' | 'member' | 'match' | 'tournament' | 'venue' | 'setting';

export interface ActivityRow {
  id: number;
  at: string;
  group_id: string | null;
  actor_member_id: string | null;
  actor_name: string | null;
  entity: ActivityEntity;
  action: string;
  session_id: string | null;
  member_id: string | null;
  summary: string;
  details: { member?: string; from?: string | number | null; to?: string | number | null; date?: string } & Record<string, unknown>;
}

export interface ActivityFilter {
  groupId: string;
  entities?: ActivityEntity[];
  /** a member id, or 'none' for changes made by "Someone" */
  actorId?: string | 'none';
  /** everything about one session */
  sessionId?: string;
  /** everything done by or about one member */
  memberId?: string;
  limit: number;
}

/** Admin only: the database checks the passcode (supabase/migrations/018_admin_only_activity_log.sql). */
export async function getActivity(f: ActivityFilter, adminCode: string): Promise<ActivityRow[]> {
  const { data, error } = await supabase.rpc('get_activity', {
    p_group: f.groupId,
    p_code: adminCode,
    p_limit: f.limit,
    p_entities: f.entities?.length ? f.entities : null,
    p_actor: f.actorId && f.actorId !== 'none' ? f.actorId : null,
    p_actor_none: f.actorId === 'none',
    p_session: f.sessionId ?? null,
    p_member: f.memberId ?? null,
  });
  if (error) {
    if (/only the admin/i.test(error.message)) throw new Error(error.message);
    throw friendlyRpcError(error.message, '018_admin_only_activity_log.sql');
  }
  return (data ?? []) as ActivityRow[];
}
