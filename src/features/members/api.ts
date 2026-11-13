import { supabase } from '../../shared/supabase';
import type { Member } from '../../shared/types';
import { cleanName, nameKey } from '../../shared/utils/nameParser';

export class DuplicateMemberError extends Error {
  existing: Member;
  constructor(existing: Member) {
    super(`“${existing.name}” is already a member of this group`);
    this.name = 'DuplicateMemberError';
    this.existing = existing;
  }
}

/** Find a member whose name matches (ignoring case, accents, extra spaces). */
export function findDuplicate(members: Member[], name: string, ignoreId?: string): Member | undefined {
  const k = nameKey(name);
  return members.find((m) => m.id !== ignoreId && nameKey(m.name) === k);
}

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
  rawName: string,
  known?: Member[]
): Promise<Member> {
  const name = cleanName(rawName);
  if (!name) throw new Error('Please enter a name');

  const members = known ?? (await getMembers(groupId));
  const dupe = findDuplicate(members, name);
  if (dupe) throw new DuplicateMemberError(dupe);

  const { data, error } = await supabase
    .from('members')
    .insert({ group_id: groupId, name })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`“${name}” is already a member of this group`);
    }
    throw error;
  }
  return data;
}

/** Adds each new name; reports which were added and which were skipped and why. */
export async function addMembersInBulk(
  groupId: string,
  names: string[]
): Promise<{ added: Member[]; skipped: { name: string; reason: string }[] }> {
  const added: Member[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const known = await getMembers(groupId);

  for (const name of names) {
    try {
      const member = await addMember(groupId, name, known);
      known.push(member);
      added.push(member);
    } catch (e) {
      skipped.push({ name, reason: (e as Error).message });
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
  rawName: string,
  groupId?: string
): Promise<Member> {
  const name = cleanName(rawName);
  if (!name) throw new Error('Name can’t be empty');

  if (groupId) {
    const dupe = findDuplicate(await getMembers(groupId), name, memberId);
    if (dupe) throw new DuplicateMemberError(dupe);
  }

  const { data, error } = await supabase
    .from('members')
    .update({ name })
    .eq('id', memberId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new Error(`“${name}” is already a member of this group`);
    throw error;
  }
  return data;
}
