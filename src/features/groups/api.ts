import { supabase } from '../../shared/supabase';
import type { Group } from '../../shared/types';

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
