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

/** The design system's four accent colours. */
export type MemberColor = 'brand' | 'lime' | 'butter' | 'coral';

export interface Member {
  id: string;
  group_id: string;
  name: string;
  /** their chosen icon (migration 013); empty = their initials */
  emoji?: string | null;
  /** background colour of their icon (migration 014); empty = picked from their name */
  color?: MemberColor | null;
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
  total_cost: number | null; // in THOUSANDS of Rupiah (208 = Rp 208.000); set by the admin, split between participants
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

/** A place the group plays at, linked to its page on AYO (see features/courts, migration 012). */
export interface GroupVenue {
  id: string;
  group_id: string;
  name: string;
  /** end of the venue's AYO link: ayo.co/v/<ayo_slug> */
  ayo_slug: string;
  /** AYO's own number for the venue */
  ayo_venue_id: number;
  created_at: string;
}

/** One session a member is in, with their share of the cost (member page). */
export interface MemberBill {
  participant_id: string;
  payment_status: PaymentStatus;
  session: Pick<Session, 'id' | 'title' | 'date' | 'start_time' | 'end_time' | 'location' | 'total_cost'>;
  /** people the cost is split between */
  participant_count: number;
  /** their share in THOUSANDS of Rupiah, or null while the session has no cost yet */
  share: number | null;
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
// Matches inside a session (see features/matchmaking)
// ============================================

export interface Match {
  id: string;
  session_id: string;
  /** game number within the session: 1, 2, 3… */
  round: number;
  court: number | null;
  /** one score per team, e.g. 21 and 18; null until the game is finished */
  score_a: number | null;
  score_b: number | null;
  created_at: string;
}

export interface MatchPlayer {
  id: string;
  match_id: string;
  member_id: string;
  team: 'A' | 'B';
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
