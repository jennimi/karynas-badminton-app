import type { Member } from '../../shared/types';

export type TournamentStatus = 'draft' | 'in_progress' | 'completed';

export interface Tournament {
  id: string;
  group_id: string;
  session_id?: string | null;
  name: string;
  status: TournamentStatus;
  created_at: string;
}

/**
 * Each tournament participant entry represents a Doubles Pair (Team).
 * Both players can be linked to existing group `Member` rows or be Guests (`member_id: null`).
 */
export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  seed: number | null;
  player1_name: string;
  player2_name: string;
  member_id: string | null;
  partner_member_id: string | null;
  created_at?: string;
}

export interface TournamentParticipantWithMember extends TournamentParticipant {
  member: Member | null;
  partner: Member | null;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_order: number;
  court: number | null;
  participant1_id: string | null;
  participant2_id: string | null;
  score_1: number | null;
  score_2: number | null;
  winner_id: string | null;
  next_match_id: string | null;
  next_match_slot: 1 | 2 | null;
  created_at: string;
}

export interface TournamentSummary extends Tournament {
  participant_count: number;
  match_count: number;
  completed_match_count: number;
  champion_pair: TournamentParticipantWithMember | null;
}

export interface TournamentDetail extends Tournament {
  participants: TournamentParticipantWithMember[];
  matches: TournamentMatch[];
}

export interface DraftDoublesPair {
  key: string;
  player1Name: string;
  player1MemberId: string | null;
  player2Name: string;
  player2MemberId: string | null;
}

export interface CreateTournamentInput {
  groupId: string;
  sessionId?: string | null;
  name: string;
  pairs: DraftDoublesPair[];
}

export interface UpdateTournamentParticipantInput {
  participantId: string;
  tournamentId: string;
  player1Name: string;
  player1MemberId: string | null;
  player2Name: string;
  player2MemberId: string | null;
}

export interface MatchPlayerConflict {
  identityKey: string;
  playerName: string;
  memberId: string | null;
  pair1ParticipantId: string;
  pair1Slot: 1 | 2;
  pair2ParticipantId: string;
  pair2Slot: 1 | 2;
}

export interface RecordMatchScoreInput {
  matchId: string;
  tournamentId: string;
  /** Explicit winning pair ID (can be set with or without scores, or null if not decided yet). */
  winnerId?: string | null;
  score1: number | null;
  score2: number | null;
  court?: number | null;
}
