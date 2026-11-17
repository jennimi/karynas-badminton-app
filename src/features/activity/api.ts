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

export async function getActivity(f: ActivityFilter): Promise<ActivityRow[]> {
  let q = supabase
    .from('activity_log')
    .select('*')
    // settings changes belong to no group
    .or(`group_id.eq.${f.groupId},group_id.is.null`)
    .order('at', { ascending: false })
    .order('id', { ascending: false })
    .limit(f.limit);
  if (f.entities?.length) q = q.in('entity', f.entities);
  if (f.actorId === 'none') q = q.is('actor_member_id', null);
  else if (f.actorId) q = q.eq('actor_member_id', f.actorId);
  if (f.sessionId) q = q.eq('session_id', f.sessionId);
  if (f.memberId) q = q.or(`member_id.eq.${f.memberId},actor_member_id.eq.${f.memberId}`);

  const { data, error } = await q;
  if (error) throw friendlyRpcError(error.message, '017_activity_log.sql');
  return (data ?? []) as ActivityRow[];
}
