import { supabase } from '../../shared/supabase';
import type { Member } from '../../shared/types';

export async function getMembers(groupId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('group_id', groupId)
    .order('name');

  if (error) throw error;
  return data;
}

export async function addMember(
  groupId: string,
  name: string
): Promise<Member> {
  const { data, error } = await supabase
    .from('members')
    .insert({ group_id: groupId, name: name.trim() })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`"${name}" already exists in this group`);
    }
    throw error;
  }
  return data;
}

export async function addMembersInBulk(
  groupId: string,
  names: string[]
): Promise<{ added: Member[]; skipped: string[] }> {
  const added: Member[] = [];
  const skipped: string[] = [];

  for (const name of names) {
    try {
      const member = await addMember(groupId, name);
      added.push(member);
    } catch {
      skipped.push(name);
    }
  }

  return { added, skipped };
}

export async function deleteMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', memberId);

  if (error) throw error;
}

export async function updateMemberName(
  memberId: string,
  name: string
): Promise<Member> {
  const { data, error } = await supabase
    .from('members')
    .update({ name: name.trim() })
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
