import { supabase } from '../../shared/supabase';
import type {
  Session,
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

  if (Object.keys(sessionFields).length > 0) {
    const { error } = await supabase
      .from('sessions')
      .update(sessionFields)
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
