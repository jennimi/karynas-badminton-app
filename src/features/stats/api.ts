import { supabase } from '../../shared/supabase';
import { friendlyRpcError } from '../../shared/utils/rpcError';
import type { MatchWithPlayers } from '../matchmaking/types';
import type { Game } from './compute';

/** A match becomes a Game once both scores are in and it has players on both sides. A tie is not a finished game. */
export function matchToGame(m: MatchWithPlayers, sessionDate: string): Game | null {
  if (m.score_a == null || m.score_b == null || m.score_a === m.score_b) return null;
  const teamA = m.players.filter((p) => p.team === 'A').map((p) => p.member_id);
  const teamB = m.players.filter((p) => p.team === 'B').map((p) => p.member_id);
  if (teamA.length === 0 || teamB.length === 0) return null;
  return {
    id: m.id,
    sessionId: m.session_id,
    date: sessionDate,
    round: m.round,
    createdAt: m.created_at,
    teamA,
    teamB,
    scoreA: m.score_a,
    scoreB: m.score_b,
  };
}

/** Every finished game of a group (all sessions), oldest data included. */
export async function getGroupGames(groupId: string): Promise<Game[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, session_id, round, score_a, score_b, created_at, session:sessions!inner(group_id, date), players:match_players(member_id, team)'
    )
    .eq('session.group_id', groupId)
    .not('score_a', 'is', null)
    .not('score_b', 'is', null)
    .limit(5000);
  if (error) throw friendlyRpcError(error.message, '009_matches.sql');

  const games: Game[] = [];
  for (const row of (data ?? []) as unknown as {
    id: string; session_id: string; round: number; score_a: number; score_b: number; created_at: string;
    session: { date: string };
    players: { member_id: string; team: 'A' | 'B' }[];
  }[]) {
    const g = matchToGame(
      { ...row, court: null, players: row.players.map((p, i) => ({ id: String(i), match_id: row.id, member: { id: p.member_id, name: '' }, ...p })) },
      row.session.date
    );
    if (g) games.push(g);
  }
  return games;
}
