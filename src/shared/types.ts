// ============================================
// Shared TypeScript types
// Used by all features — Karyna's and Gavin's
// ============================================

export interface Group {
  id: string;
  name: string;
  emoji: string;
  created_at: string;
}

export interface Member {
  id: string;
  group_id: string;
  name: string;
  created_at: string;
}

export interface Session {
  id: string;
  group_id: string;
  title: string | null;
  date: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM
  end_time: string | null; // HH:MM
  location: string | null;
  courts: number | null; // courts booked
  total_cost: number | null; // set by the admin, split between participants
  notes: string | null;
  created_at: string;
}

export type PaymentStatus = 'unpaid' | 'pending' | 'approved';

export interface SessionParticipant {
  id: string;
  session_id: string;
  member_id: string;
  payment_status: PaymentStatus;
  paid_at: string | null;
  approved_at: string | null;
  created_at: string;
}

// Group with headline numbers (dashboard cards)
export interface GroupSummary extends Group {
  member_count: number;
  session_count: number;
}

// Session with how many people are signed up (list views)
export interface SessionSummary extends Session {
  participant_count: number;
  /** participants whose payment the admin approved */
  approved_count: number;
  /** participants who marked paid, waiting for approval */
  pending_count: number;
}

// Joined type: participant with member info
export interface ParticipantWithMember extends SessionParticipant {
  member: Member;
}

// Session with its participants
export interface SessionWithParticipants extends Session {
  participants: ParticipantWithMember[];
}

// ============================================
// Gavin's types — stubs for matchmaking
// ============================================

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

// Input for creating a session
export interface CreateSessionInput {
  group_id: string;
  title?: string;
  date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  courts?: number | null;
  notes?: string;
  participant_member_ids: string[];
}

// Input for updating a session
export interface UpdateSessionInput {
  title?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  courts?: number | null;
  notes?: string;
  participant_member_ids?: string[];
}
