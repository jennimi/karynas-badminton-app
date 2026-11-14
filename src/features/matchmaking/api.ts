import { supabase } from '../../shared/supabase';
import { friendlyRpcError } from '../../shared/utils/rpcError';
import type { MatchInput, MatchWithPlayers } from './types';

// Tables: matches + match_players (supabase/migrations/009_matches.sql).

const missingTable = (message: string) => /matches|match_players|schema cache|does not exist/i.test(message);

function fail(error: { message: string }): never {
  throw new Error(
    missingTable(error.message)
      ? 'Matches need a database update: run supabase/migrations/009_matches.sql in the Supabase SQL Editor.'
      : error.message
  );
}

/** All matches of a session, in the order they were played. */
export async function getMatches(sessionId: string): Promise<MatchWithPlayers[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*, players:match_players(id, match_id, member_id, team, member:members(id, name))')
    .eq('session_id', sessionId)
    .order('round', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) fail(error);
  return (data ?? []) as unknown as MatchWithPlayers[];
}

const playerRows = (matchId: string, input: MatchInput) => [
  ...input.teamA.map((member_id) => ({ match_id: matchId, member_id, team: 'A' })),
  ...input.teamB.map((member_id) => ({ match_id: matchId, member_id, team: 'B' })),
];

export async function createMatch(sessionId: string, round: number, input: MatchInput) {
  // one step in the database: the match and its players are created together
  const { error } = await supabase.rpc('create_match', {
    p_session: sessionId,
    p_round: round,
    p_court: input.court,
    p_score_a: input.score_a,
    p_score_b: input.score_b,
    p_team_a: input.teamA,
    p_team_b: input.teamB,
  });
  if (error) throw friendlyRpcError(error.message, '010_admin_deletes.sql');
}

export async function updateMatch(matchId: string, input: MatchInput) {
  const { error } = await supabase
    .from('matches')
    .update({ court: input.court, score_a: input.score_a, score_b: input.score_b })
    .eq('id', matchId);
  if (error) fail(error);

  const { error: clearError } = await supabase.from('match_players').delete().eq('match_id', matchId);
  if (clearError) fail(clearError);
  const { error: playersError } = await supabase.from('match_players').insert(playerRows(matchId, input));
  if (playersError) fail(playersError);
}

/** Admin only: the database checks the passcode (supabase/migrations/010_admin_deletes.sql). */
export async function deleteMatch(matchId: string, adminCode: string) {
  const { error } = await supabase.rpc('delete_match', { p_match: matchId, p_code: adminCode });
  if (error) throw friendlyRpcError(error.message, '010_admin_deletes.sql');
}
