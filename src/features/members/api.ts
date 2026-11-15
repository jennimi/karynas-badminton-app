import { supabase } from '../../shared/supabase';
import { friendlyRpcError } from '../../shared/utils/rpcError';
import type { Member, MemberBill, MemberColor, PaymentStatus, Session } from '../../shared/types';
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

/** Admin only: the database checks the passcode (supabase/migrations/010_admin_deletes.sql). */
export async function deleteMember(memberId: string, adminCode: string): Promise<void> {
  const { error } = await supabase.rpc('delete_member', { p_member: memberId, p_code: adminCode });
  if (error) throw friendlyRpcError(error.message, '010_admin_deletes.sql');
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

export async function getMember(memberId: string): Promise<Member> {
  const { data, error } = await supabase.from('members').select('*').eq('id', memberId).single();
  if (error) throw error;
  return data;
}

/** Set a member's own emoji; null goes back to the automatic one. */
export async function updateMemberEmoji(memberId: string, emoji: string | null): Promise<Member> {
  const value = emoji?.trim() || null;
  const { data, error } = await supabase
    .from('members')
    .update({ emoji: value })
    .eq('id', memberId)
    .select()
    .single();
  if (error) {
    if (error.code === '23514') throw new Error('Use one emoji (or a few characters at most).');
    throw friendlyRpcError(error.message, '013_member_emoji.sql');
  }
  return data;
}

/** Set the background colour of a member's icon; null goes back to the automatic one. */
export async function updateMemberColor(memberId: string, color: MemberColor | null): Promise<Member> {
  const { data, error } = await supabase.from('members').update({ color }).eq('id', memberId).select().single();
  if (error) throw friendlyRpcError(error.message, '014_member_color.sql');
  return data;
}

/** Every session a member is in (newest first), with their payment status and share of the cost. */
export async function getMemberBills(memberId: string): Promise<MemberBill[]> {
  const { data, error } = await supabase
    .from('session_participants')
    .select(
      'id, payment_status, session:sessions!inner(id, title, date, start_time, end_time, location, total_cost, session_participants(count))'
    )
    .eq('member_id', memberId);
  if (error) throw error;

  type Row = {
    id: string;
    payment_status: PaymentStatus;
    session: MemberBill['session'] & Pick<Session, 'total_cost'> & { session_participants: { count: number }[] };
  };
  return ((data ?? []) as unknown as Row[])
    .map((row) => {
      const { session_participants: counts, ...session } = row.session;
      const n = counts?.[0]?.count ?? 0;
      return {
        participant_id: row.id,
        payment_status: row.payment_status,
        session,
        participant_count: n,
        share: session.total_cost != null && n > 0 ? session.total_cost / n : null,
      };
    })
    .sort((a, b) => b.session.date.localeCompare(a.session.date));
}
