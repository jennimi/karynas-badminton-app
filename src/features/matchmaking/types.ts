/**
 * Matchmaking types — Gavin's module
 *
 * These define the shape of matchmaking data.
 * The shared types (Member, Session, etc.) live in src/shared/types.ts.
 */

export interface Match {
  id: string;
  session_id: string;
  round: number;
  court: number | null;
  created_at: string;
}

export interface MatchPlayer {
  id: string;
  match_id: string;
  member_id: string;
  team: 'A' | 'B';
  score: number | null;
}

export interface MatchWithPlayers extends Match {
  players: (MatchPlayer & { member_name: string })[];
  score_a: number | null;
  score_b: number | null;
}
