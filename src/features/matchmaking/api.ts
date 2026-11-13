/**
 * Matchmaking API — Gavin's module
 *
 * To get the list of participants for a session, use:
 *   import { getSessionParticipants } from '../sessions/api';
 *   const participants = await getSessionParticipants(sessionId);
 *
 * That returns Member[] — the same members shown in the session detail page.
 *
 * Database tables for matchmaking (Gavin to create via migration):
 *   - matches (id, session_id, round, court, created_at)
 *   - match_players (id, match_id, member_id, team, score)
 *
 * See docs/CONTRIBUTING-GAVIN.md for full details.
 */

// TODO: Gavin implements these
export {};
