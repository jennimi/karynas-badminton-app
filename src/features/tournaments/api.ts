import { supabase } from '../../shared/supabase';
import { computeScorePropagation, generateBracketMatches } from './bracket';
import type {
  CreateTournamentInput,
  RecordMatchScoreInput,
  Tournament,
  TournamentDetail,
  TournamentMatch,
  TournamentParticipant,
  TournamentParticipantWithMember,
  TournamentSummary,
} from './types';

interface RawTournamentSummaryRow extends Tournament {
  tournament_participants: TournamentParticipantWithMember[];
  tournament_matches: {
    id: string;
    round: number;
    participant1_id: string | null;
    participant2_id: string | null;
    winner_id: string | null;
    next_match_id: string | null;
  }[];
}

/**
 * Fetch all tournaments for a group, enriched with doubles pair counts, match progress,
 * and the champion pair (when completed).
 */
export async function getTournaments(groupId: string): Promise<TournamentSummary[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select(
      `
      *,
      tournament_participants (
        *,
        member:members!tournament_participants_member_id_fkey (*),
        partner:members!tournament_participants_partner_member_id_fkey (*)
      ),
      tournament_matches (
        id,
        round,
        participant1_id,
        participant2_id,
        winner_id,
        next_match_id
      )
    `
    )
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as RawTournamentSummaryRow[];

  return rows.map((row) => {
    const participants = row.tournament_participants ?? [];
    const matches = row.tournament_matches ?? [];

    const playableMatches = matches.filter(
      (m) =>
        !(
          m.round === 1 &&
          ((m.participant1_id && !m.participant2_id) ||
            (!m.participant1_id && m.participant2_id))
        )
    );
    const completedPlayable = playableMatches.filter((m) => m.winner_id !== null);

    const maxRound = matches.reduce((max, m) => Math.max(max, m.round), 0);
    const finalMatch =
      matches.find((m) => m.round === maxRound && m.next_match_id === null) ??
      matches.find((m) => m.round === maxRound);

    const championPair = finalMatch?.winner_id
      ? (participants.find((p) => p.id === finalMatch.winner_id) ?? null)
      : null;

    return {
      id: row.id,
      group_id: row.group_id,
      name: row.name,
      status: row.status,
      created_at: row.created_at,
      participant_count: participants.length,
      match_count: playableMatches.length,
      completed_match_count: completedPlayable.length,
      champion_pair: championPair,
    };
  });
}

/**
 * Fetch a single tournament with its seeded doubles pairs (joined with Member & Partner)
 * and all bracket matches ordered by round and match_order.
 */
export async function getTournament(tournamentId: string): Promise<TournamentDetail> {
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tErr) throw tErr;

  const { data: participantsData, error: pErr } = await supabase
    .from('tournament_participants')
    .select(
      `
      *,
      member:members!tournament_participants_member_id_fkey (*),
      partner:members!tournament_participants_partner_member_id_fkey (*)
    `
    )
    .eq('tournament_id', tournamentId)
    .order('seed', { ascending: true, nullsFirst: false });

  if (pErr) throw pErr;

  const { data: matchesData, error: mErr } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })
    .order('match_order', { ascending: true });

  if (mErr) throw mErr;

  return {
    ...(tournament as unknown as Tournament),
    participants: (participantsData ?? []) as unknown as TournamentParticipantWithMember[],
    matches: (matchesData ?? []) as unknown as TournamentMatch[],
  };
}

/**
 * Create a new doubles tournament from a list of pairs (supporting both Group Members and Guests),
 * generate the power-of-2 single-elimination bracket with automatic Round 1 BYE advancement,
 * and persist all matches.
 */
export async function createTournament({
  groupId,
  name,
  pairs,
}: CreateTournamentInput): Promise<Tournament> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Please enter a tournament name.');
  }

  const validPairs = pairs.filter(
    (p) => p.player1Name.trim().length > 0 && p.player2Name.trim().length > 0
  );

  if (validPairs.length < 2) {
    throw new Error('Add at least 2 doubles pairs to start a tournament.');
  }

  // 1. Insert tournament record
  const { data: tournamentRow, error: tErr } = await supabase
    .from('tournaments')
    .insert({
      group_id: groupId,
      name: trimmedName,
      status: 'in_progress',
    })
    .select('*')
    .single();

  if (tErr) throw tErr;
  const tournament = tournamentRow as unknown as Tournament;

  // 2. Insert tournament_participants (Doubles Pairs) with 1-indexed seeds
  const participantPayloads = validPairs.map((pair, index) => ({
    tournament_id: tournament.id,
    seed: index + 1,
    player1_name: pair.player1Name.trim(),
    player2_name: pair.player2Name.trim(),
    member_id: pair.player1MemberId,
    partner_member_id: pair.player2MemberId,
  }));

  const { data: insertedParticipants, error: pErr } = await supabase
    .from('tournament_participants')
    .insert(participantPayloads)
    .select('*');

  if (pErr) throw pErr;

  const participants = (insertedParticipants ?? []) as unknown as TournamentParticipant[];

  // 3. Generate bracket blueprints using pure domain logic
  const blueprints = generateBracketMatches(
    participants.map((p) => ({ id: p.id, seed: p.seed }))
  );

  // 4. Insert matches from highest round (Finals) down to Round 1 so next_match_id
  // foreign keys resolve cleanly.
  const maxRound = blueprints.reduce((max, b) => Math.max(max, b.round), 1);
  const tempKeyToDbId = new Map<string, string>();

  for (let round = maxRound; round >= 1; round--) {
    const roundBlueprints = blueprints
      .filter((b) => b.round === round)
      .sort((a, b) => a.match_order - b.match_order);

    const rowsToInsert = roundBlueprints.map((b) => ({
      tournament_id: tournament.id,
      round: b.round,
      match_order: b.match_order,
      participant1_id: b.participant1_id,
      participant2_id: b.participant2_id,
      score_1: b.score_1,
      score_2: b.score_2,
      winner_id: b.winner_id,
      next_match_id: b.nextMatchTempKey ? (tempKeyToDbId.get(b.nextMatchTempKey) ?? null) : null,
      next_match_slot: b.next_match_slot,
    }));

    const { data: insertedMatches, error: mErr } = await supabase
      .from('tournament_matches')
      .insert(rowsToInsert)
      .select('id, round, match_order');

    if (mErr) throw mErr;

    const insertedList = (insertedMatches ?? []) as unknown as {
      id: string;
      round: number;
      match_order: number;
    }[];

    for (const m of insertedList) {
      tempKeyToDbId.set(`R${m.round}-M${m.match_order}`, m.id);
    }
  }

  return tournament;
}

/**
 * Record or edit a match winner and/or optional scores (before or after completion),
 * cascading any winner changes or resets down `next_match_id` slots.
 */
export async function recordMatchScore({
  matchId,
  tournamentId,
  winnerId,
  score1,
  score2,
  court,
}: RecordMatchScoreInput): Promise<void> {
  const { data: matchesData, error: fetchErr } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId);

  if (fetchErr) throw fetchErr;

  const allMatches = (matchesData ?? []) as unknown as TournamentMatch[];
  const targetMatch = allMatches.find((m) => m.id === matchId);
  if (!targetMatch) {
    throw new Error('Match not found.');
  }

  const plan = computeScorePropagation(
    targetMatch,
    score1,
    score2,
    allMatches,
    court,
    winnerId
  );

  // 1. Update current match
  const { error: uErr } = await supabase
    .from('tournament_matches')
    .update(plan.matchUpdate)
    .eq('id', matchId);

  if (uErr) throw uErr;

  // 2. Apply downstream patches (forward-fill winner or cascade human-error corrections)
  for (const downstream of plan.downstreamPatches) {
    const { error: nextErr } = await supabase
      .from('tournament_matches')
      .update(downstream.patch)
      .eq('id', downstream.matchId);

    if (nextErr) throw nextErr;
  }

  // 3. Sync tournament status ('in_progress' or 'completed')
  const { error: tErr } = await supabase
    .from('tournaments')
    .update({ status: plan.nextTournamentStatus })
    .eq('id', tournamentId);

  if (tErr) throw tErr;
}

/**
 * Delete a tournament and cascade-delete its participants and matches.
 */
export async function deleteTournament(tournamentId: string): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .delete()
    .eq('id', tournamentId);

  if (error) throw error;
}
