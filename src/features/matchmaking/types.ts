/** Matches inside a session. The base types live in src/shared/types.ts. */
import type { Match, MatchPlayer } from '../../shared/types';

export type { Match, MatchPlayer };
export type Team = 'A' | 'B';

export interface MatchPlayerWithMember extends MatchPlayer {
  member: { id: string; name: string };
}

export interface MatchWithPlayers extends Match {
  players: MatchPlayerWithMember[];
}

/** What the "add / edit match" pop-up saves. */
export interface MatchInput {
  court: number | null;
  teamA: string[]; // member ids
  teamB: string[];
  score_a: number | null;
  score_b: number | null;
}
