import { supabase } from '../../shared/supabase';

export type Target = { kind: 'member'; id: string } | { kind: 'new'; name: string } | { kind: 'skip' };
export type Mapping = Target & { confirmed: boolean };

/** Who a chat nickname is. `before*`: sessions before that date mean someone else. */
export interface NameRule {
  core: string;
  target: Target;
  confirmed: boolean;
  beforeDate: string | null;
  beforeTarget: Target | null;
}

export interface ChatLink {
  draftKey: string;
  sessionId: string | null;
  status: 'draft' | 'imported' | 'skipped';
  overrides: Record<string, Target>;
}

export async function getNameRules(groupId: string): Promise<Record<string, NameRule>> {
  const { data, error } = await supabase.from('chat_name_map').select('*').eq('group_id', groupId);
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((r) => [
      r.core as string,
      {
        core: r.core,
        target: r.target,
        confirmed: r.confirmed,
        beforeDate: r.before_date,
        beforeTarget: r.before_target,
      } as NameRule,
    ])
  );
}

export async function saveNameRules(groupId: string, rules: NameRule[]) {
  if (rules.length === 0) return;
  const { error } = await supabase.from('chat_name_map').upsert(
    rules.map((r) => ({
      group_id: groupId,
      core: r.core,
      target: r.target,
      confirmed: r.confirmed,
      before_date: r.beforeDate,
      before_target: r.beforeTarget,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'group_id,core' }
  );
  if (error) throw error;
}

export async function getLinks(groupId: string): Promise<Record<string, ChatLink>> {
  const { data, error } = await supabase.from('chat_links').select('*').eq('group_id', groupId);
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((r) => [
      r.draft_key as string,
      { draftKey: r.draft_key, sessionId: r.session_id, status: r.status, overrides: r.overrides ?? {} } as ChatLink,
    ])
  );
}

export async function saveLink(groupId: string, link: ChatLink) {
  const { error } = await supabase.from('chat_links').upsert(
    {
      group_id: groupId,
      draft_key: link.draftKey,
      session_id: link.sessionId,
      status: link.status,
      overrides: link.overrides,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'group_id,draft_key' }
  );
  if (error) throw error;
}
