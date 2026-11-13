import { supabase } from '../../shared/supabase';
import type { Group, GroupSummary } from '../../shared/types';

/**
 * Get or create the default group.
 * For now we use a single group. The schema supports multiple
 * groups for future expansion.
 */
export async function getOrCreateDefaultGroup(): Promise<Group> {
  // Try to get the first group
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (data) return data;

  // No group exists yet — create the default one
  if (error?.code === 'PGRST116') {
    const { data: newGroup, error: createError } = await supabase
      .from('groups')
      .insert({ name: 'Badminton Group', emoji: '🏸' })
      .select()
      .single();

    if (createError) throw createError;
    return newGroup;
  }

  throw error;
}

/** All groups with member/session counts, oldest first. */
export async function getGroups(): Promise<GroupSummary[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('*, members(count), sessions(count)')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => {
    const { members, sessions, ...group } = row as Group & {
      members: { count: number }[];
      sessions: { count: number }[];
    };
    return {
      ...group,
      member_count: members?.[0]?.count ?? 0,
      session_count: sessions?.[0]?.count ?? 0,
    };
  });
}

export async function getGroup(groupId: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (error) throw error;
  return data;
}

export async function createGroup(input: {
  name: string;
  emoji: string;
}): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert({ name: input.name.trim(), emoji: input.emoji || '🏸' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateGroup(
  groupId: string,
  input: { name: string; emoji: string }
): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .update({ name: input.name.trim(), emoji: input.emoji || '🏸' })
    .eq('id', groupId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
