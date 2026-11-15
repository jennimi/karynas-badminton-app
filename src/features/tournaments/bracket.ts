import type { Member } from '../../shared/types';
import { cleanName, nameKey } from '../../shared/utils/nameParser';
import type {
  DraftDoublesPair,
  TournamentMatch,
  TournamentParticipant,
  TournamentStatus,
} from './types';

export interface SeededParticipantInput {
  id: string;
  seed: number | null;
}

export interface GeneratedMatchBlueprint {
  tempKey: string;
  round: number;
  match_order: number;
  participant1_id: string | null;
  participant2_id: string | null;
  score_1: number | null;
  score_2: number | null;
  winner_id: string | null;
  nextMatchTempKey: string | null;
  next_match_slot: 1 | 2 | null;
}

export interface DownstreamMatchPatch {
  matchId: string;
  patch: {
    participant1_id?: string | null;
    participant2_id?: string | null;
    winner_id?: string | null;
    score_1?: number | null;
    score_2?: number | null;
  };
}

export interface ScorePropagationPlan {
  matchUpdate: {
    score_1: number | null;
    score_2: number | null;
    winner_id: string | null;
    court?: number | null;
  };
  downstreamPatches: DownstreamMatchPatch[];
  nextTournamentStatus: TournamentStatus;
}

/**
 * Format a doubles pair's display name: "Player 1 & Player 2".
 */
export function formatPairName(
  pair: Pick<TournamentParticipant, 'player1_name' | 'player2_name'>
): string {
  return `${pair.player1_name} & ${pair.player2_name}`;
}

/**
 * Match a raw player name against existing group members (case/accent-insensitive).
 * Returns the cleaned display name and the matched member (or null if Guest).
 */
export function resolvePlayerIdentity(
  rawName: string,
  existingMembers: Member[]
): { name: string; member: Member | null } {
  const cleaned = cleanName(rawName);
  if (!cleaned) {
    return { name: '', member: null };
  }
  const key = nameKey(cleaned);
  const matched = existingMembers.find((m) => nameKey(m.name) === key) ?? null;
  return {
    name: matched ? matched.name : cleaned,
    member: matched,
  };
}

/**
 * Parse a multiline block of pasted/typed text into Doubles Pairs.
 * Supports lines like:
 * - "Gavin & Karyna"
 * - "1. Theo / Sarah"
 * - "Alex + Budi"
 * - "Kevin - Marcus"
 * - "Natalia, Guest Joe"
 * Unmatched names are kept seamlessly as Guests (`memberId: null`).
 */
export function parseDoublesPairLines(
  rawText: string,
  existingMembers: Member[]
): DraftDoublesPair[] {
  const lines = rawText
    .split(/\r\n|\r|\n|\u2028|\u2029/)
    .map((l) => l.trim())
    .filter(Boolean);

  const pairs: DraftDoublesPair[] = [];

  lines.forEach((rawLine, idx) => {
    // Strip leading list numbering ("1.", "1)", "- ", "• ")
    const stripped = rawLine
      .replace(/^\s*\d+\s*[.):-]\s*/, '')
      .replace(/^\s*[-•*–—·▪●○◦]\s*/, '')
      .trim();

    if (!stripped) return;

    // Split on common pair delimiters: &, /, +, comma, " and ", " with ", " - "
    const parts = stripped
      .split(/\s*(?:&|\/|\+|,|;| vs\.? | and | with |\s[-–—]\s)\s*/i)
      .map((p) => cleanName(p))
      .filter(Boolean);

    if (parts.length === 0) return;

    const p1Raw = parts[0];
    const p2Raw = parts[1] || 'Guest Partner';

    const p1 = resolvePlayerIdentity(p1Raw, existingMembers);
    const p2 = resolvePlayerIdentity(p2Raw, existingMembers);

    if (!p1.name) return;

    pairs.push({
      key: `pair-${idx}-${nameKey(p1.name)}-${nameKey(p2.name || 'guest')}`,
      player1Name: p1.name,
      player1MemberId: p1.member?.id ?? null,
      player2Name: p2.name || 'Guest Partner',
      player2MemberId: p2.member?.id ?? null,
    });
  });

  return pairs;
}

/**
 * Smallest power of 2 greater than or equal to max(2, count).
 * e.g. 2 -> 2, 3 -> 4, 5 -> 8, 8 -> 8, 12 -> 16.
 */
export function nextPowerOfTwo(count: number): number {
  const n = Math.max(2, count);
  let p = 2;
  while (p < n) {
    p *= 2;
  }
  return p;
}

/**
 * Generates standard single-elimination bracket seed pairs for a power-of-2 size.
 * - size 2: [[1, 2]]
 * - size 4: [[1, 4], [2, 3]]
 * - size 8: [[1, 8], [4, 5], [2, 7], [3, 6]]
 * - size 16: [[1, 16], [8, 9], [4, 13], [5, 12], [2, 15], [7, 10], [3, 14], [6, 11]]
 */
export function getStandardSeedPairs(bracketSize: number): [number, number][] {
  const size = nextPowerOfTwo(bracketSize);
  let pairs: [number, number][] = [[1, 2]];

  while (pairs.length * 2 < size) {
    const nextSize = pairs.length * 4;
    const expanded: [number, number][] = [];
    for (const [a, b] of pairs) {
      expanded.push([a, nextSize + 1 - a]);
      expanded.push([b, nextSize + 1 - b]);
    }
    pairs = expanded;
  }

  return pairs;
}

/**
 * Human-readable round label based on distance from the Finals.
 */
export function getRoundLabel(round: number, totalRounds: number): string {
  const remaining = totalRounds - round;
  if (remaining === 0) return 'Finals';
  if (remaining === 1) return 'Semifinals';
  if (remaining === 2) return 'Quarterfinals';
  return `Round ${round}`;
}

/**
 * Pre-generates all knockout bracket matches across all rounds, distributes
 * seeded doubles pairs using standard bracket seeding, and automatically advances
 * Round 1 BYEs into Round 2.
 */
export function generateBracketMatches(
  participants: SeededParticipantInput[]
): GeneratedMatchBlueprint[] {
  if (participants.length < 2) {
    throw new Error('At least 2 doubles pairs are required to generate a bracket');
  }

  const ordered = [...participants].sort((a, b) => {
    const sa = a.seed ?? Number.MAX_SAFE_INTEGER;
    const sb = b.seed ?? Number.MAX_SAFE_INTEGER;
    return sa - sb;
  });

  const bracketSize = nextPowerOfTwo(ordered.length);
  const totalRounds = Math.round(Math.log2(bracketSize));

  const byKey = new Map<string, GeneratedMatchBlueprint>();
  const allMatches: GeneratedMatchBlueprint[] = [];

  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    for (let order = 1; order <= matchesInRound; order++) {
      const tempKey = `R${round}-M${order}`;
      const hasNext = round < totalRounds;
      const nextOrder = Math.ceil(order / 2);
      const nextSlot: 1 | 2 | null = hasNext ? (order % 2 === 1 ? 1 : 2) : null;
      const node: GeneratedMatchBlueprint = {
        tempKey,
        round,
        match_order: order,
        participant1_id: null,
        participant2_id: null,
        score_1: null,
        score_2: null,
        winner_id: null,
        nextMatchTempKey: hasNext ? `R${round + 1}-M${nextOrder}` : null,
        next_match_slot: nextSlot,
      };
      byKey.set(tempKey, node);
      allMatches.push(node);
    }
  }

  const seedPairs = getStandardSeedPairs(bracketSize);
  seedPairs.forEach(([seed1, seed2], idx) => {
    const matchOrder = idx + 1;
    const r1Match = byKey.get(`R1-M${matchOrder}`);
    if (!r1Match) return;

    const p1 = ordered[seed1 - 1]?.id ?? null;
    const p2 = ordered[seed2 - 1]?.id ?? null;

    r1Match.participant1_id = p1;
    r1Match.participant2_id = p2;

    if (p1 && !p2) {
      r1Match.winner_id = p1;
      if (r1Match.nextMatchTempKey && r1Match.next_match_slot) {
        const nextMatch = byKey.get(r1Match.nextMatchTempKey);
        if (nextMatch) {
          if (r1Match.next_match_slot === 1) {
            nextMatch.participant1_id = p1;
          } else {
            nextMatch.participant2_id = p1;
          }
        }
      }
    } else if (!p1 && p2) {
      r1Match.winner_id = p2;
      if (r1Match.nextMatchTempKey && r1Match.next_match_slot) {
        const nextMatch = byKey.get(r1Match.nextMatchTempKey);
        if (nextMatch) {
          if (r1Match.next_match_slot === 1) {
            nextMatch.participant1_id = p2;
          } else {
            nextMatch.participant2_id = p2;
          }
        }
      }
    }
  });

  return allMatches;
}

/**
 * Pure helper that supports:
 * 1. Immediate winner selection WITHOUT requiring scores (`score1 = null, score2 = null`).
 * 2. Editing scores BEFORE a winner is chosen (`winnerId = null`, scores saved on the match).
 * 3. Editing scores AFTER a winner is chosen, or switching the winner in case of human error,
 *    automatically cascading the corrected winner down `next_match_id` slots.
 */
export function computeScorePropagation(
  match: TournamentMatch,
  score1: number | null,
  score2: number | null,
  allMatches: TournamentMatch[],
  court?: number | null,
  explicitWinnerId?: string | null
): ScorePropagationPlan {
  if (!match.participant1_id || !match.participant2_id) {
    throw new Error('Both doubles pairs must be in this match before updating it.');
  }

  if (score1 !== null && (!Number.isInteger(score1) || score1 < 0)) {
    throw new Error('Score 1 must be a whole number (0 or higher).');
  }
  if (score2 !== null && (!Number.isInteger(score2) || score2 < 0)) {
    throw new Error('Score 2 must be a whole number (0 or higher).');
  }

  // Determine resulting winner_id:
  // - If explicitWinnerId is passed (including null to keep match in-progress/reset winner), respect it!
  // - Otherwise infer from score1 vs score2 if both scores are provided and unequal.
  let resolvedWinnerId: string | null = null;
  if (explicitWinnerId !== undefined) {
    if (
      explicitWinnerId !== null &&
      explicitWinnerId !== match.participant1_id &&
      explicitWinnerId !== match.participant2_id
    ) {
      throw new Error('Selected winner does not belong to this match.');
    }
    resolvedWinnerId = explicitWinnerId;
  } else if (score1 !== null && score2 !== null && score1 !== score2) {
    resolvedWinnerId = score1 > score2 ? match.participant1_id : match.participant2_id;
  } else {
    resolvedWinnerId = null;
  }

  const oldWinnerId = match.winner_id;
  const downstreamPatches: DownstreamMatchPatch[] = [];

  // Map of match state after applying our changes so we can accurately check Finals completion
  const matchById = new Map<string, TournamentMatch>();
  for (const m of allMatches) {
    matchById.set(m.id, { ...m });
  }

  const updatedCurrent = matchById.get(match.id);
  if (updatedCurrent) {
    updatedCurrent.score_1 = score1;
    updatedCurrent.score_2 = score2;
    updatedCurrent.winner_id = resolvedWinnerId;
  }

  // Propagate to immediate next_match_id and cascade if a human error changed/cleared a previous winner
  if (match.next_match_id && match.next_match_slot) {
    const immediateNext = matchById.get(match.next_match_id);
    if (immediateNext) {
      const slotField =
        match.next_match_slot === 1 ? 'participant1_id' : 'participant2_id';

      const immediatePatch: DownstreamMatchPatch['patch'] = {
        [slotField]: resolvedWinnerId,
      };
      immediateNext[slotField] = resolvedWinnerId;

      // If the winner changed (or was cleared) and the immediate next match had already
      // recorded the old winner as winning THAT match too, clear the stale downstream result
      // and continue clearing oldWinnerId further down the tree.
      if (oldWinnerId && oldWinnerId !== resolvedWinnerId) {
        if (immediateNext.winner_id === oldWinnerId) {
          immediatePatch.winner_id = null;
          immediateNext.winner_id = null;
        }
        downstreamPatches.push({
          matchId: immediateNext.id,
          patch: immediatePatch,
        });

        // Walk any deeper rounds where oldWinnerId was mistakenly advanced
        let cursor = immediateNext;
        while (cursor.next_match_id && cursor.next_match_slot) {
          const deeper = matchById.get(cursor.next_match_id);
          if (!deeper) break;
          const deeperSlotField =
            cursor.next_match_slot === 1 ? 'participant1_id' : 'participant2_id';
          if (deeper[deeperSlotField] !== oldWinnerId) break;

          const deeperPatch: DownstreamMatchPatch['patch'] = {
            [deeperSlotField]: null,
          };
          deeper[deeperSlotField] = null;
          if (deeper.winner_id === oldWinnerId) {
            deeperPatch.winner_id = null;
            deeper.winner_id = null;
          }
          downstreamPatches.push({
            matchId: deeper.id,
            patch: deeperPatch,
          });
          cursor = deeper;
        }
      } else {
        downstreamPatches.push({
          matchId: immediateNext.id,
          patch: immediatePatch,
        });
      }
    }
  }

  // Check if final match has a winner after applying all patches
  const simulatedMatches = Array.from(matchById.values());
  const maxRound = simulatedMatches.reduce((max, m) => Math.max(max, m.round), match.round);
  const finalMatch =
    simulatedMatches.find((m) => m.round === maxRound && m.next_match_id === null) ??
    simulatedMatches.find((m) => m.round === maxRound);

  const finalHasWinner = Boolean(finalMatch?.winner_id);

  return {
    matchUpdate: {
      score_1: score1,
      score_2: score2,
      winner_id: resolvedWinnerId,
      ...(court !== undefined ? { court } : {}),
    },
    downstreamPatches,
    nextTournamentStatus: finalHasWinner ? 'completed' : 'in_progress',
  };
}
