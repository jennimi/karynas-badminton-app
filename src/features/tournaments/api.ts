import { supabase } from '../../shared/supabase';
import {
  computeScorePropagation,
  computeTournamentStandings,
  generateBracketMatches,
  getPlayableMatches,
  getPlayerIdentityKey,
  type GeneratedMatchBlueprint,
} from './bracket';
import type {
  BracketType,
  CreateTournamentInput,
  RecordMatchScoreInput,
  Tournament,
  TournamentDetail,
  TournamentFormat,
  TournamentMatch,
  TournamentParticipant,
  TournamentParticipantWithMember,
  TournamentSummary,
  UpdateTournamentParticipantInput,
} from './types';

interface RawTournamentMatchSummaryRow {
  id: string;
  bracket_type?: BracketType | null;
  round: number;
  match_order?: number;
  participant1_id: string | null;
  participant2_id: string | null;
  score_1?: number | null;
  score_2?: number | null;
  winner_id: string | null;
  next_match_id: string | null;
  next_match_slot?: 1 | 2 | null;
  loser_match_id?: string | null;
  loser_match_slot?: 1 | 2 | null;
}

interface RawTournamentSummaryRow extends Omit<Tournament, 'format' | 'has_grand_final_reset'> {
  format?: TournamentFormat | null;
  has_grand_final_reset?: boolean | null;
  tournament_participants: TournamentParticipantWithMember[];
  tournament_matches: RawTournamentMatchSummaryRow[];
}

function normalizeTournament(
  row: Omit<Tournament, 'format' | 'has_grand_final_reset'> & {
    format?: TournamentFormat | null;
    has_grand_final_reset?: boolean | null;
  }
): Tournament {
  return {
    ...row,
    format: row.format ?? 'single_elimination',
    has_grand_final_reset: row.has_grand_final_reset ?? true,
  };
}

function normalizeMatch(
  m: Omit<TournamentMatch, 'bracket_type' | 'loser_match_id' | 'loser_match_slot'> & {
    bracket_type?: BracketType | null;
    loser_match_id?: string | null;
    loser_match_slot?: 1 | 2 | null;
  }
): TournamentMatch {
  return {
    ...m,
    bracket_type: m.bracket_type ?? 'winner',
    loser_match_id: m.loser_match_id ?? null,
    loser_match_slot: m.loser_match_slot ?? null,
  };
}

function mapRawTournamentSummaries(
  rows: RawTournamentSummaryRow[]
): TournamentSummary[] {
  return rows.map((row) => {
    const format: TournamentFormat = row.format ?? 'single_elimination';
    const participants = row.tournament_participants ?? [];
    const matches: TournamentMatch[] = (row.tournament_matches ?? []).map((m, idx) => ({
      id: m.id,
      tournament_id: row.id,
      bracket_type: m.bracket_type ?? 'winner',
      round: m.round,
      match_order: m.match_order ?? idx + 1,
      court: null,
      participant1_id: m.participant1_id,
      participant2_id: m.participant2_id,
      score_1: m.score_1 ?? null,
      score_2: m.score_2 ?? null,
      winner_id: m.winner_id,
      next_match_id: m.next_match_id,
      next_match_slot: m.next_match_slot ?? null,
      loser_match_id: m.loser_match_id ?? null,
      loser_match_slot: m.loser_match_slot ?? null,
      created_at: row.created_at,
    }));

    const playableMatches = getPlayableMatches(matches);
    const completedPlayable = playableMatches.filter((m) => m.winner_id !== null);
    const standings = computeTournamentStandings(matches, participants, format);

    return {
      id: row.id,
      group_id: row.group_id,
      session_id: row.session_id ?? null,
      name: row.name,
      status: row.status,
      format,
      has_grand_final_reset: row.has_grand_final_reset ?? true,
      created_at: row.created_at,
      participant_count: participants.length,
      match_count: playableMatches.length,
      completed_match_count: completedPlayable.length,
      champion_pair: standings.first,
    };
  });
}

const TOURNAMENT_SUMMARY_SELECT = `
  *,
  tournament_participants (
    *,
    member:members!tournament_participants_member_id_fkey (*),
    partner:members!tournament_participants_partner_member_id_fkey (*)
  ),
  tournament_matches (
    id,
    bracket_type,
    round,
    match_order,
    participant1_id,
    participant2_id,
    score_1,
    score_2,
    winner_id,
    next_match_id,
    next_match_slot,
    loser_match_id,
    loser_match_slot
  )
`;

const TOURNAMENT_SUMMARY_LEGACY_SELECT = `
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
`;

function isMissing019ColumnError(message: string): boolean {
  return /bracket_type|loser_match_id|loser_match_slot|has_grand_final_reset|\bformat\b/i.test(
    message
  );
}

/**
 * Fetch all tournaments for a group, enriched with doubles pair counts, match progress,
 * and the champion pair (when completed).
 */
export async function getTournaments(groupId: string): Promise<TournamentSummary[]> {
  let { data, error } = await supabase
    .from('tournaments')
    .select(TOURNAMENT_SUMMARY_SELECT)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error && isMissing019ColumnError(error.message)) {
    const fallback = await supabase
      .from('tournaments')
      .select(TOURNAMENT_SUMMARY_LEGACY_SELECT)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) throw error;

  return mapRawTournamentSummaries((data ?? []) as unknown as RawTournamentSummaryRow[]);
}

/**
 * Fetch tournaments linked to a specific session (`tournaments.session_id`),
 * gracefully returning [] if migration 016 has not been applied yet.
 */
export async function getSessionTournaments(
  sessionId: string
): Promise<TournamentSummary[]> {
  let { data, error } = await supabase
    .from('tournaments')
    .select(TOURNAMENT_SUMMARY_SELECT)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error && isMissing019ColumnError(error.message) && !/session_id/i.test(error.message)) {
    const fallback = await supabase
      .from('tournaments')
      .select(TOURNAMENT_SUMMARY_LEGACY_SELECT)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) {
    if (/session_id|column|schema cache/i.test(error.message)) {
      return [];
    }
    throw error;
  }

  return mapRawTournamentSummaries((data ?? []) as unknown as RawTournamentSummaryRow[]);
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

  const normalizedTournament = normalizeTournament(
    tournament as unknown as Tournament
  );
  const normalizedMatches = ((matchesData ?? []) as unknown as TournamentMatch[]).map(
    normalizeMatch
  );

  return {
    ...normalizedTournament,
    participants: (participantsData ?? []) as unknown as TournamentParticipantWithMember[],
    matches: normalizedMatches,
  };
}

/**
 * Compute topological depth from sinks (0 = no next/loser downstream match)
 * so matches can be inserted sink-to-source and both `next_match_id` and
 * `loser_match_id` foreign keys resolve cleanly.
 */
function computeBlueprintLayers(
  blueprints: GeneratedMatchBlueprint[]
): GeneratedMatchBlueprint[][] {
  const byKey = new Map<string, GeneratedMatchBlueprint>();
  for (const b of blueprints) {
    byKey.set(b.tempKey, b);
  }

  const depthCache = new Map<string, number>();
  const visiting = new Set<string>();

  const getDepth = (key: string): number => {
    const cached = depthCache.get(key);
    if (cached !== undefined) return cached;
    if (visiting.has(key)) return 0;
    visiting.add(key);

    const bp = byKey.get(key);
    if (!bp) {
      visiting.delete(key);
      return 0;
    }

    const nextDepth = bp.nextMatchTempKey ? 1 + getDepth(bp.nextMatchTempKey) : 0;
    const loserDepth = bp.loserMatchTempKey ? 1 + getDepth(bp.loserMatchTempKey) : 0;
    const depth = Math.max(nextDepth, loserDepth);

    visiting.delete(key);
    depthCache.set(key, depth);
    return depth;
  };

  let maxDepth = 0;
  for (const b of blueprints) {
    const d = getDepth(b.tempKey);
    if (d > maxDepth) maxDepth = d;
  }

  const layers: GeneratedMatchBlueprint[][] = Array.from(
    { length: maxDepth + 1 },
    () => []
  );
  for (const b of blueprints) {
    const d = getDepth(b.tempKey);
    layers[d].push(b);
  }

  return layers;
}

/**
 * Create a new doubles tournament from a list of pairs (supporting both Group Members and Guests),
 * generate either a Single Elimination or Double Elimination bracket with automatic Round 1 BYE
 * advancement, and persist all matches.
 */
export async function createTournament({
  groupId,
  sessionId,
  name,
  pairs,
  format = 'single_elimination',
  hasGrandFinalReset = true,
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

  // 1. Insert tournament record (with graceful fallback if 016/019 columns are not yet migrated)
  let tournamentRow: unknown = null;
  let tErr: { message: string } | null = null;
  let useLegacyMatchInsert = false;

  const firstAttempt = await supabase
    .from('tournaments')
    .insert({
      group_id: groupId,
      name: trimmedName,
      status: 'in_progress',
      format,
      has_grand_final_reset: hasGrandFinalReset,
      ...(sessionId ? { session_id: sessionId } : {}),
    })
    .select('*')
    .single();

  tournamentRow = firstAttempt.data;
  tErr = firstAttempt.error;

  if (tErr && isMissing019ColumnError(tErr.message)) {
    if (format === 'double_elimination') {
      throw new Error(
        'Double Elimination requires running migration 019_double_elimination_tournaments.sql in Supabase.'
      );
    }
    useLegacyMatchInsert = true;
    const fallbackPayload: Record<string, unknown> = {
      group_id: groupId,
      name: trimmedName,
      status: 'in_progress',
      ...(sessionId ? { session_id: sessionId } : {}),
    };
    let legacyAttempt = await supabase
      .from('tournaments')
      .insert(fallbackPayload)
      .select('*')
      .single();

    if (
      legacyAttempt.error &&
      sessionId &&
      /session_id|column|schema cache/i.test(legacyAttempt.error.message)
    ) {
      legacyAttempt = await supabase
        .from('tournaments')
        .insert({
          group_id: groupId,
          name: trimmedName,
          status: 'in_progress',
        })
        .select('*')
        .single();
    }
    tournamentRow = legacyAttempt.data;
    tErr = legacyAttempt.error;
  } else if (tErr && sessionId && /session_id|column|schema cache/i.test(tErr.message)) {
    const fallbackAttempt = await supabase
      .from('tournaments')
      .insert({
        group_id: groupId,
        name: trimmedName,
        status: 'in_progress',
        format,
        has_grand_final_reset: hasGrandFinalReset,
      })
      .select('*')
      .single();
    tournamentRow = fallbackAttempt.data;
    tErr = fallbackAttempt.error;
  }

  if (tErr) throw tErr;
  const tournament = normalizeTournament(tournamentRow as unknown as Tournament);

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
    participants.map((p) => ({ id: p.id, seed: p.seed })),
    { format, hasGrandFinalReset }
  );

  // 4. Insert matches in reverse topological order (sinks first) so both
  //    `next_match_id` and `loser_match_id` foreign keys resolve cleanly.
  const layers = computeBlueprintLayers(blueprints);
  const tempKeyToDbId = new Map<string, string>();

  for (const layer of layers) {
    if (layer.length === 0) continue;

    const sortedLayer = [...layer].sort(
      (a, b) => a.round - b.round || a.match_order - b.match_order
    );

    const rowsToInsert = sortedLayer.map((b) => {
      const baseRow = {
        tournament_id: tournament.id,
        round: b.round,
        match_order: b.match_order,
        participant1_id: b.participant1_id,
        participant2_id: b.participant2_id,
        score_1: b.score_1,
        score_2: b.score_2,
        winner_id: b.winner_id,
        next_match_id: b.nextMatchTempKey
          ? (tempKeyToDbId.get(b.nextMatchTempKey) ?? null)
          : null,
        next_match_slot: b.next_match_slot,
      };
      if (useLegacyMatchInsert) {
        return baseRow;
      }
      return {
        ...baseRow,
        bracket_type: b.bracket_type,
        loser_match_id: b.loserMatchTempKey
          ? (tempKeyToDbId.get(b.loserMatchTempKey) ?? null)
          : null,
        loser_match_slot: b.loser_match_slot,
      };
    });

    const selectCols = useLegacyMatchInsert
      ? 'id, round, match_order'
      : 'id, bracket_type, round, match_order';

    const { data: insertedMatches, error: mErr } = await supabase
      .from('tournament_matches')
      .insert(rowsToInsert)
      .select(selectCols);

    if (mErr) throw mErr;

    const insertedList = (insertedMatches ?? []) as unknown as {
      id: string;
      bracket_type?: BracketType;
      round: number;
      match_order: number;
    }[];

    for (const inserted of insertedList) {
      const bType = inserted.bracket_type ?? 'winner';
      const matching = sortedLayer.find(
        (bp) =>
          bp.bracket_type === bType &&
          bp.round === inserted.round &&
          bp.match_order === inserted.match_order
      );
      if (matching) {
        tempKeyToDbId.set(matching.tempKey, inserted.id);
      }
    }
  }

  return tournament;
}

/**
 * Record or edit a match winner and/or optional scores (before or after completion),
 * cascading any winner/loser changes or resets down both `next_match_id` and `loser_match_id` slots.
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

  const allMatches = ((matchesData ?? []) as unknown as TournamentMatch[]).map(
    normalizeMatch
  );
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

  // 2. Apply downstream patches (forward-fill winner/loser or cascade human-error corrections)
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
 * Update a doubles team's players/partners mid-tournament without breaking bracket match links.
 * Uses the `update_tournament_participant` RPC and gracefully falls back to a direct table update
 * if migration 016 has not been applied yet.
 */
export async function updateTournamentParticipant({
  participantId,
  player1Name,
  player1MemberId,
  player2Name,
  player2MemberId,
}: UpdateTournamentParticipantInput): Promise<TournamentParticipant> {
  const p1 = player1Name.trim();
  const p2 = player2Name.trim();
  if (!p1 || !p2) {
    throw new Error('Both Player 1 and Player 2 names are required.');
  }

  const key1 = getPlayerIdentityKey(p1, player1MemberId);
  const key2 = getPlayerIdentityKey(p2, player2MemberId);
  if ((player1MemberId && player1MemberId === player2MemberId) || (key1 && key1 === key2)) {
    throw new Error('A player cannot be partnered with themselves on the same doubles team.');
  }

  const { data, error } = await supabase.rpc('update_tournament_participant', {
    p_participant_id: participantId,
    p_player1_name: p1,
    p_player2_name: p2,
    p_member_id: player1MemberId,
    p_partner_member_id: player2MemberId,
  });

  if (!error) {
    return data as unknown as TournamentParticipant;
  }

  if (!/update_tournament_participant|function|schema cache|does not exist/i.test(error.message)) {
    throw error;
  }

  const { data: fallbackRow, error: uErr } = await supabase
    .from('tournament_participants')
    .update({
      player1_name: p1,
      player2_name: p2,
      member_id: player1MemberId,
      partner_member_id: player2MemberId,
    })
    .eq('id', participantId)
    .select('*')
    .single();

  if (uErr) throw uErr;
  return fallbackRow as unknown as TournamentParticipant;
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
