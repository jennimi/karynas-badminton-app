import { supabase } from '../../shared/supabase';
import type {
  Session,
  SessionSummary,
  SessionWithParticipants,
  CreateSessionInput,
  UpdateSessionInput,
  Member,
} from '../../shared/types';

export async function getSessions(groupId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('group_id', groupId)
    .order('date', { ascending: false });

  if (error) throw error;
  return data;
}

/** All sessions of a group (newest first) with a participant count. */
export async function getSessionSummaries(
  groupId: string
): Promise<SessionSummary[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, session_participants(count)')
    .eq('group_id', groupId)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => {
    const { session_participants, ...session } = row as Session & {
      session_participants: { count: number }[];
    };
    return {
      ...session,
      participant_count: session_participants?.[0]?.count ?? 0,
    };
  });
}

/** Next upcoming sessions across all groups (dashboard). */
export async function getUpcomingSessions(
  today: string,
  limit = 5
): Promise<SessionSummary[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, session_participants(count)')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => {
    const { session_participants, ...session } = row as Session & {
      session_participants: { count: number }[];
    };
    return {
      ...session,
      participant_count: session_participants?.[0]?.count ?? 0,
    };
  });
}

/** Which members attended which session — used for statistics. */
export async function getAttendance(
  groupId: string
): Promise<{ session_id: string; member_id: string }[]> {
  const { data, error } = await supabase
    .from('session_participants')
    .select('session_id, member_id, session:sessions!inner(group_id)')
    .eq('session.group_id', groupId);

  if (error) throw error;
  return (data ?? []).map((r) => ({
    session_id: r.session_id as string,
    member_id: r.member_id as string,
  }));
}

export async function getSession(
  sessionId: string
): Promise<SessionWithParticipants> {
  const { data, error } = await supabase
    .from('sessions')
    .select(
      `
      *,
      participants:session_participants(
        *,
        member:members(*)
      )
    `
    )
    .eq('id', sessionId)
    .single();

  if (error) throw error;
  return data as SessionWithParticipants;
}

export async function createSession(
  input: CreateSessionInput
): Promise<Session> {
  // Create the session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      group_id: input.group_id,
      title: input.title || null,
      date: input.date,
      start_time: input.start_time || null,
      end_time: input.end_time || null,
      location: input.location || null,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (sessionError) throw sessionError;

  // Add participants
  if (input.participant_member_ids.length > 0) {
    const { error: partError } = await supabase
      .from('session_participants')
      .insert(
        input.participant_member_ids.map((memberId) => ({
          session_id: session.id,
          member_id: memberId,
        }))
      );

    if (partError) throw partError;
  }

  return session;
}

export async function updateSession(
  sessionId: string,
  input: UpdateSessionInput
): Promise<void> {
  // Update session fields (excluding participants)
  const { participant_member_ids, ...sessionFields } = input;

  // Optional fields: an empty form value must be stored as NULL
  // (Postgres rejects '' for time columns).
  const optional = ['title', 'start_time', 'end_time', 'location', 'notes'] as const;
  const fields: Record<string, string | null | undefined> = { ...sessionFields };
  for (const key of optional) {
    if (key in fields) fields[key] = fields[key] || null;
  }

  if (Object.keys(fields).length > 0) {
    const { error } = await supabase
      .from('sessions')
      .update(fields)
      .eq('id', sessionId);

    if (error) throw error;
  }

  // Update participants if provided
  if (participant_member_ids !== undefined) {
    // Remove all existing participants
    const { error: deleteError } = await supabase
      .from('session_participants')
      .delete()
      .eq('session_id', sessionId);

    if (deleteError) throw deleteError;

    // Add new participants
    if (participant_member_ids.length > 0) {
      const { error: insertError } = await supabase
        .from('session_participants')
        .insert(
          participant_member_ids.map((memberId) => ({
            session_id: sessionId,
            member_id: memberId,
          }))
        );

      if (insertError) throw insertError;
    }
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId);

  if (error) throw error;
}

/**
 * Get participants for a session — this is the shared function Gavin's
 * matchmaking module will use.
 */
export async function getSessionParticipants(
  sessionId: string
): Promise<Member[]> {
  const { data, error } = await supabase
    .from('session_participants')
    .select('member:members(*)')
    .eq('session_id', sessionId);

  if (error) throw error;
  // Supabase types the join as member: any[] but it's actually a single object
  // because of the FK constraint. Cast accordingly.
  return data.map(
    (row) => (row as unknown as { member: Member }).member
  );
}
