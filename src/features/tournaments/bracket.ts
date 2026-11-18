import type { Member } from '../../shared/types';
import { cleanName, nameKey } from '../../shared/utils/nameParser';
import type {
  BracketType,
  DraftDoublesPair,
  MatchPlayerConflict,
  TournamentFormat,
  TournamentMatch,
  TournamentParticipant,
  TournamentParticipantWithMember,
  TournamentStandings,
  TournamentStatus,
} from './types';

export interface SeededParticipantInput {
  id: string;
  seed: number | null;
}

export interface GeneratedMatchBlueprint {
  tempKey: string;
  bracket_type: BracketType;
  round: number;
  match_order: number;
  participant1_id: string | null;
  participant2_id: string | null;
  score_1: number | null;
  score_2: number | null;
  winner_id: string | null;
  nextMatchTempKey: string | null;
  next_match_slot: 1 | 2 | null;
  loserMatchTempKey: string | null;
  loser_match_slot: 1 | 2 | null;
}

export interface GenerateBracketOptions {
  format?: TournamentFormat;
  hasGrandFinalReset?: boolean;
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
 * Stable identity key for a player (member ID if linked, otherwise normalized name key).
 */
export function getPlayerIdentityKey(name: string, memberId: string | null): string {
  if (memberId) {
    return `member:${memberId}`;
  }
  const normalized = nameKey(cleanName(name));
  return normalized ? `name:${normalized}` : '';
}

/**
 * Detect whether the same player appears on both opposing doubles pairs in a match.
 */
export function detectMatchPlayerConflicts(
  participant1: TournamentParticipant | null,
  participant2: TournamentParticipant | null
): MatchPlayerConflict[] {
  if (!participant1 || !participant2) return [];

  const p1Slots: { slot: 1 | 2; name: string; memberId: string | null; key: string }[] = [
    {
      slot: 1,
      name: participant1.player1_name,
      memberId: participant1.member_id,
      key: getPlayerIdentityKey(participant1.player1_name, participant1.member_id),
    },
    {
      slot: 2,
      name: participant1.player2_name,
      memberId: participant1.partner_member_id,
      key: getPlayerIdentityKey(participant1.player2_name, participant1.partner_member_id),
    },
  ];

  const p2Slots: { slot: 1 | 2; name: string; memberId: string | null; key: string }[] = [
    {
      slot: 1,
      name: participant2.player1_name,
      memberId: participant2.member_id,
      key: getPlayerIdentityKey(participant2.player1_name, participant2.member_id),
    },
    {
      slot: 2,
      name: participant2.player2_name,
      memberId: participant2.partner_member_id,
      key: getPlayerIdentityKey(participant2.player2_name, participant2.partner_member_id),
    },
  ];

  const conflicts: MatchPlayerConflict[] = [];
  const seenKeys = new Set<string>();

  for (const s1 of p1Slots) {
    if (!s1.key) continue;
    for (const s2 of p2Slots) {
      if (!s2.key || s1.key !== s2.key || seenKeys.has(s1.key)) continue;
      seenKeys.add(s1.key);
      conflicts.push({
        identityKey: s1.key,
        playerName: s1.name,
        memberId: s1.memberId ?? s2.memberId,
        pair1ParticipantId: participant1.id,
        pair1Slot: s1.slot,
        pair2ParticipantId: participant2.id,
        pair2Slot: s2.slot,
      });
    }
  }

  return conflicts;
}

/**
 * Count how many doubles teams each player identity belongs to across a list of pairs.
 */
export function getMultiTeamPlayerCounts(
  pairs: Array<{
    player1Name: string;
    player1MemberId: string | null;
    player2Name: string;
    player2MemberId: string | null;
  }>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const pair of pairs) {
    const k1 = getPlayerIdentityKey(pair.player1Name, pair.player1MemberId);
    const k2 = getPlayerIdentityKey(pair.player2Name, pair.player2MemberId);
    if (k1) {
      counts.set(k1, (counts.get(k1) ?? 0) + 1);
    }
    if (k2 && k2 !== k1) {
      counts.set(k2, (counts.get(k2) ?? 0) + 1);
    }
  }
  return counts;
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
 * Stage-aware round label supporting Single Elimination and Double Elimination brackets.
 */
export function getBracketRoundLabel(
  bracketType: BracketType,
  round: number,
  totalRoundsInBracket: number,
  format: TournamentFormat = 'single_elimination'
): string {
  if (format === 'single_elimination') {
    return getRoundLabel(round, totalRoundsInBracket);
  }
  if (bracketType === 'grand_final') {
    return 'Grand Final';
  }
  if (bracketType === 'grand_final_reset') {
    return 'Grand Final Reset';
  }

  const remaining = totalRoundsInBracket - round;
  const prefix = bracketType === 'loser' ? 'Losers' : 'Winners';
  if (remaining === 0) return `${prefix} Finals`;
  if (remaining === 1) return `${prefix} Semifinals`;
  if (bracketType === 'winner' && remaining === 2) {
    return 'Winners Quarterfinals';
  }
  return `${prefix} Round ${round}`;
}

/**
 * Returns true if a match is an automatic Round 1 BYE (single seeded pair auto-advanced).
 */
export function isRound1ByeMatch(
  match: Pick<
    TournamentMatch,
    'round' | 'participant1_id' | 'participant2_id' | 'winner_id' | 'score_1' | 'score_2'
  > & { bracket_type?: BracketType }
): boolean {
  const bracketType = match.bracket_type ?? 'winner';
  return (
    bracketType === 'winner' &&
    match.round === 1 &&
    ((match.participant1_id !== null && match.participant2_id === null) ||
      (match.participant1_id === null && match.participant2_id !== null)) &&
    match.winner_id !== null &&
    match.score_1 === null &&
    match.score_2 === null
  );
}

/**
 * Returns true if a Grand Final Reset match is actually triggered/playable.
 */
export function isResetMatchActive(
  resetMatch: Pick<
    TournamentMatch,
    'bracket_type' | 'participant1_id' | 'participant2_id' | 'winner_id'
  >,
  allMatches: Pick<
    TournamentMatch,
    'bracket_type' | 'participant1_id' | 'participant2_id' | 'winner_id'
  >[]
): boolean {
  if (resetMatch.bracket_type !== 'grand_final_reset') return true;
  if (
    (resetMatch.participant1_id !== null && resetMatch.participant2_id !== null) ||
    resetMatch.winner_id !== null
  ) {
    return true;
  }
  const grandFinal = allMatches.find((m) => m.bracket_type === 'grand_final');
  return Boolean(
    grandFinal &&
      grandFinal.winner_id !== null &&
      grandFinal.winner_id === grandFinal.participant2_id
  );
}

/**
 * Filter matches down to playable matches (excluding Round 1 BYEs and unneeded Grand Final Resets).
 */
export function getPlayableMatches<
  T extends Pick<
    TournamentMatch,
    | 'round'
    | 'participant1_id'
    | 'participant2_id'
    | 'winner_id'
    | 'score_1'
    | 'score_2'
  > & { bracket_type?: BracketType },
>(matches: T[]): T[] {
  return matches.filter((m) => {
    if (isRound1ByeMatch(m)) return false;
    if (m.bracket_type === 'grand_final_reset') {
      return isResetMatchActive(
        {
          bracket_type: m.bracket_type,
          participant1_id: m.participant1_id,
          participant2_id: m.participant2_id,
          winner_id: m.winner_id,
        },
        matches.map((item) => ({
          bracket_type: item.bracket_type ?? 'winner',
          participant1_id: item.participant1_id,
          participant2_id: item.participant2_id,
          winner_id: item.winner_id,
        }))
      );
    }
    return true;
  });
}

/**
 * Describe where the losing pair of a match drops (or whether a loss eliminates them).
 */
export function getLoserDestinationLabel(
  match: TournamentMatch,
  allMatches: TournamentMatch[],
  format: TournamentFormat
): string | null {
  if (format === 'single_elimination') {
    return null;
  }
  if (match.bracket_type === 'loser') {
    return 'Loser is eliminated';
  }
  if (match.bracket_type === 'grand_final') {
    const hasReset = allMatches.some((m) => m.bracket_type === 'grand_final_reset');
    if (!hasReset) {
      return 'Championship deciding match';
    }
    return 'LB champ win forces Grand Final Reset';
  }
  if (match.bracket_type === 'grand_final_reset') {
    return 'Winner-take-all Championship match';
  }
  if (!match.loser_match_id) {
    return null;
  }
  const target = allMatches.find((m) => m.id === match.loser_match_id);
  if (!target) return null;
  if (target.bracket_type === 'grand_final') {
    return 'Loser drops to Grand Final';
  }
  const loserMatches = allMatches.filter((m) => m.bracket_type === 'loser');
  const maxLoserRound = loserMatches.reduce((max, m) => Math.max(max, m.round), 1);
  if (target.round === maxLoserRound) {
    return 'Loser drops to Losers Finals';
  }
  if (target.round === maxLoserRound - 1 && maxLoserRound >= 2) {
    return 'Loser drops to Losers Semifinals';
  }
  return `Loser → Losers R${target.round} #${target.match_order}`;
}

/**
 * Compute Top 4 placements (1st, 2nd, 3rd, 4th) for a tournament.
 */
export function computeTournamentStandings(
  matches: TournamentMatch[],
  participants: TournamentParticipantWithMember[],
  format: TournamentFormat = 'single_elimination'
): TournamentStandings {
  const byId = new Map<string, TournamentParticipantWithMember>();
  for (const p of participants) {
    byId.set(p.id, p);
  }

  const getLoserId = (m: TournamentMatch | undefined): string | null => {
    if (!m || !m.winner_id) return null;
    if (m.winner_id === m.participant1_id) return m.participant2_id;
    if (m.winner_id === m.participant2_id) return m.participant1_id;
    return null;
  };

  if (format === 'single_elimination') {
    const maxRound = matches.reduce((max, m) => Math.max(max, m.round), 0);
    const finalMatch =
      matches.find((m) => m.round === maxRound && m.next_match_id === null) ??
      matches.find((m) => m.round === maxRound);
    const first = finalMatch?.winner_id ? (byId.get(finalMatch.winner_id) ?? null) : null;
    const secondId = getLoserId(finalMatch);
    const second = secondId ? (byId.get(secondId) ?? null) : null;
    return { first, second, third: null, fourth: null };
  }

  const gfMatch = matches.find((m) => m.bracket_type === 'grand_final');
  const gfrMatch = matches.find((m) => m.bracket_type === 'grand_final_reset');

  let decidingMatch: TournamentMatch | undefined;
  if (gfrMatch?.winner_id) {
    decidingMatch = gfrMatch;
  } else if (
    gfMatch?.winner_id &&
    (gfMatch.winner_id === gfMatch.participant1_id || !gfrMatch)
  ) {
    decidingMatch = gfMatch;
  }

  const first = decidingMatch?.winner_id
    ? (byId.get(decidingMatch.winner_id) ?? null)
    : null;
  const secondId = getLoserId(decidingMatch);
  const second = secondId ? (byId.get(secondId) ?? null) : null;

  const loserMatches = matches.filter((m) => m.bracket_type === 'loser');
  const maxLoserRound = loserMatches.reduce((max, m) => Math.max(max, m.round), 0);
  const lbFinal =
    maxLoserRound > 0
      ? loserMatches.find((m) => m.round === maxLoserRound)
      : undefined;

  const thirdId = getLoserId(lbFinal);
  const third = thirdId ? (byId.get(thirdId) ?? null) : null;

  let fourth: TournamentParticipantWithMember | null = null;
  if (participants.length >= 4 && lbFinal && maxLoserRound >= 2) {
    const lbSemifinal = loserMatches.find(
      (m) => m.round === maxLoserRound - 1 && m.next_match_id === lbFinal.id
    );
    const fourthId = getLoserId(lbSemifinal);
    fourth = fourthId ? (byId.get(fourthId) ?? null) : null;
  }

  return { first, second, third, fourth };
}

/**
 * Pre-generates all knockout bracket matches across all rounds, distributes
 * seeded doubles pairs using standard bracket seeding, and automatically advances
 * Round 1 BYEs. Supports both Single Elimination and Double Elimination formats.
 */
export function generateBracketMatches(
  participants: SeededParticipantInput[],
  options?: GenerateBracketOptions
): GeneratedMatchBlueprint[] {
  if (participants.length < 2) {
    throw new Error('At least 2 doubles pairs are required to generate a bracket');
  }

  const ordered = [...participants].sort((a, b) => {
    const sa = a.seed ?? Number.MAX_SAFE_INTEGER;
    const sb = b.seed ?? Number.MAX_SAFE_INTEGER;
    return sa - sb;
  });

  if (options?.format === 'double_elimination') {
    return generateDoubleEliminationMatches(
      ordered,
      options.hasGrandFinalReset ?? true
    );
  }

  return generateSingleEliminationMatches(ordered);
}

function generateSingleEliminationMatches(
  ordered: SeededParticipantInput[]
): GeneratedMatchBlueprint[] {
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
        bracket_type: 'winner',
        round,
        match_order: order,
        participant1_id: null,
        participant2_id: null,
        score_1: null,
        score_2: null,
        winner_id: null,
        nextMatchTempKey: hasNext ? `R${round + 1}-M${nextOrder}` : null,
        next_match_slot: nextSlot,
        loserMatchTempKey: null,
        loser_match_slot: null,
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

    const byeWinner = p1 && !p2 ? p1 : !p1 && p2 ? p2 : null;
    if (byeWinner) {
      r1Match.winner_id = byeWinner;
      if (r1Match.nextMatchTempKey && r1Match.next_match_slot) {
        const nextMatch = byKey.get(r1Match.nextMatchTempKey);
        if (nextMatch) {
          if (r1Match.next_match_slot === 1) {
            nextMatch.participant1_id = byeWinner;
          } else {
            nextMatch.participant2_id = byeWinner;
          }
        }
      }
    }
  });

  return allMatches;
}

/**
 * Generates a full Double Elimination bracket (Winners Bracket, compacted Losers Bracket
 * without phantom BYE matches, Grand Final, and optional Grand Final Reset) with
 * cross-bracketed loser drops to avoid immediate rematches.
 */
function generateDoubleEliminationMatches(
  ordered: SeededParticipantInput[],
  hasGrandFinalReset: boolean
): GeneratedMatchBlueprint[] {
  const bracketSize = nextPowerOfTwo(ordered.length);
  const k = Math.round(Math.log2(bracketSize));

  // Degenerate 2-team Double Elimination: WB Match 1 feeds both GF slots
  if (bracketSize === 2) {
    const gfKey = 'GF-R1-M1';
    const gfrKey = 'GFR-R1-M1';
    const wb1: GeneratedMatchBlueprint = {
      tempKey: 'WB-R1-M1',
      bracket_type: 'winner',
      round: 1,
      match_order: 1,
      participant1_id: ordered[0]?.id ?? null,
      participant2_id: ordered[1]?.id ?? null,
      score_1: null,
      score_2: null,
      winner_id: null,
      nextMatchTempKey: gfKey,
      next_match_slot: 1,
      loserMatchTempKey: gfKey,
      loser_match_slot: 2,
    };
    const gf: GeneratedMatchBlueprint = {
      tempKey: gfKey,
      bracket_type: 'grand_final',
      round: 1,
      match_order: 1,
      participant1_id: null,
      participant2_id: null,
      score_1: null,
      score_2: null,
      winner_id: null,
      nextMatchTempKey: hasGrandFinalReset ? gfrKey : null,
      next_match_slot: hasGrandFinalReset ? 1 : null,
      loserMatchTempKey: null,
      loser_match_slot: null,
    };
    const result = [wb1, gf];
    if (hasGrandFinalReset) {
      result.push({
        tempKey: gfrKey,
        bracket_type: 'grand_final_reset',
        round: 2,
        match_order: 1,
        participant1_id: null,
        participant2_id: null,
        score_1: null,
        score_2: null,
        winner_id: null,
        nextMatchTempKey: null,
        next_match_slot: null,
        loserMatchTempKey: null,
        loser_match_slot: null,
      });
    }
    return result;
  }

  const gfKey = 'GF-R1-M1';
  const gfrKey = 'GFR-R1-M1';
  const byKey = new Map<string, GeneratedMatchBlueprint>();

  // 1. Upper / Winners Bracket (k rounds)
  for (let round = 1; round <= k; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    for (let order = 1; order <= matchesInRound; order++) {
      const tempKey = `WB-R${round}-M${order}`;
      const isWbFinal = round === k;
      const nextOrder = Math.ceil(order / 2);
      const nextSlot: 1 | 2 = isWbFinal ? 1 : order % 2 === 1 ? 1 : 2;
      const nextMatchTempKey = isWbFinal ? gfKey : `WB-R${round + 1}-M${nextOrder}`;

      let loserMatchTempKey: string | null = null;
      let loserSlot: 1 | 2 | null = null;
      if (round === 1) {
        loserMatchTempKey = `LB-R1-M${Math.ceil(order / 2)}`;
        loserSlot = order % 2 === 1 ? 1 : 2;
      } else {
        const s = round - 1;
        const dropCount = bracketSize / Math.pow(2, s + 1);
        const crossOrder = dropCount + 1 - order;
        loserMatchTempKey = `LB-R${2 * s}-M${crossOrder}`;
        loserSlot = 1;
      }

      byKey.set(tempKey, {
        tempKey,
        bracket_type: 'winner',
        round,
        match_order: order,
        participant1_id: null,
        participant2_id: null,
        score_1: null,
        score_2: null,
        winner_id: null,
        nextMatchTempKey,
        next_match_slot: nextSlot,
        loserMatchTempKey,
        loser_match_slot: loserSlot,
      });
    }
  }

  // 2. Uncompacted Lower / Losers Bracket (2 * (k - 1) rounds)
  const totalUncompactedLbRounds = 2 * (k - 1);
  for (let s = 1; s <= k - 1; s++) {
    const count = bracketSize / Math.pow(2, s + 1);
    const minorRound = 2 * s - 1;
    const majorRound = 2 * s;

    for (let order = 1; order <= count; order++) {
      const minorKey = `LB-R${minorRound}-M${order}`;
      byKey.set(minorKey, {
        tempKey: minorKey,
        bracket_type: 'loser',
        round: minorRound,
        match_order: order,
        participant1_id: null,
        participant2_id: null,
        score_1: null,
        score_2: null,
        winner_id: null,
        nextMatchTempKey: `LB-R${majorRound}-M${order}`,
        next_match_slot: 2,
        loserMatchTempKey: null,
        loser_match_slot: null,
      });

      const majorKey = `LB-R${majorRound}-M${order}`;
      const isLbFinal = s === k - 1;
      byKey.set(majorKey, {
        tempKey: majorKey,
        bracket_type: 'loser',
        round: majorRound,
        match_order: order,
        participant1_id: null,
        participant2_id: null,
        score_1: null,
        score_2: null,
        winner_id: null,
        nextMatchTempKey: isLbFinal ? gfKey : `LB-R${majorRound + 1}-M${Math.ceil(order / 2)}`,
        next_match_slot: isLbFinal ? 2 : order % 2 === 1 ? 1 : 2,
        loserMatchTempKey: null,
        loser_match_slot: null,
      });
    }
  }

  // 3. Seed WB Round 1 and resolve Round 1 BYEs without dropping phantom losers into LB
  const seedPairs = getStandardSeedPairs(bracketSize);
  seedPairs.forEach(([seed1, seed2], idx) => {
    const matchOrder = idx + 1;
    const r1Match = byKey.get(`WB-R1-M${matchOrder}`);
    if (!r1Match) return;

    const p1 = ordered[seed1 - 1]?.id ?? null;
    const p2 = ordered[seed2 - 1]?.id ?? null;

    r1Match.participant1_id = p1;
    r1Match.participant2_id = p2;

    const byeWinner = p1 && !p2 ? p1 : !p1 && p2 ? p2 : null;
    if (byeWinner) {
      r1Match.winner_id = byeWinner;
      r1Match.loserMatchTempKey = null;
      r1Match.loser_match_slot = null;

      if (r1Match.nextMatchTempKey && r1Match.next_match_slot) {
        const nextMatch = byKey.get(r1Match.nextMatchTempKey);
        if (nextMatch) {
          if (r1Match.next_match_slot === 1) {
            nextMatch.participant1_id = byeWinner;
          } else {
            nextMatch.participant2_id = byeWinner;
          }
        }
      }
    }
  });

  // 4. Prune phantom LB matches (0 or 1 incoming team paths due to WB R1 BYEs)
  for (let lbRound = 1; lbRound <= totalUncompactedLbRounds; lbRound++) {
    const roundNodes = Array.from(byKey.values())
      .filter((m) => m.bracket_type === 'loser' && m.round === lbRound)
      .sort((a, b) => a.match_order - b.match_order);

    for (const node of roundNodes) {
      const feeders: Array<{
        source: GeneratedMatchBlueprint;
        via: 'winner' | 'loser';
      }> = [];

      for (const candidate of byKey.values()) {
        if (candidate.nextMatchTempKey === node.tempKey) {
          feeders.push({ source: candidate, via: 'winner' });
        }
        if (candidate.loserMatchTempKey === node.tempKey) {
          feeders.push({ source: candidate, via: 'loser' });
        }
      }

      if (feeders.length === 0) {
        byKey.delete(node.tempKey);
      } else if (feeders.length === 1) {
        const { source, via } = feeders[0];
        if (via === 'winner') {
          source.nextMatchTempKey = node.nextMatchTempKey;
          source.next_match_slot = node.next_match_slot;
        } else {
          source.loserMatchTempKey = node.nextMatchTempKey;
          source.loser_match_slot = node.next_match_slot;
        }
        byKey.delete(node.tempKey);
      }
    }
  }

  // 5. Compact surviving LB round numbers and match orders sequentially (1..R, 1..M)
  const survivingLbMatches = Array.from(byKey.values()).filter(
    (m) => m.bracket_type === 'loser'
  );
  const survivingRoundNums = Array.from(
    new Set(survivingLbMatches.map((m) => m.round))
  ).sort((a, b) => a - b);

  const keyRemap = new Map<string, string>();
  survivingRoundNums.forEach((oldRound, roundIdx) => {
    const newRound = roundIdx + 1;
    const matchesInRound = survivingLbMatches
      .filter((m) => m.round === oldRound)
      .sort((a, b) => a.match_order - b.match_order);

    matchesInRound.forEach((m, orderIdx) => {
      const newOrder = orderIdx + 1;
      const newKey = `LB-R${newRound}-M${newOrder}`;
      keyRemap.set(m.tempKey, newKey);
      m.round = newRound;
      m.match_order = newOrder;
    });
  });

  for (const m of byKey.values()) {
    m.tempKey = keyRemap.get(m.tempKey) ?? m.tempKey;
    if (m.nextMatchTempKey) {
      m.nextMatchTempKey = keyRemap.get(m.nextMatchTempKey) ?? m.nextMatchTempKey;
    }
    if (m.loserMatchTempKey) {
      m.loserMatchTempKey = keyRemap.get(m.loserMatchTempKey) ?? m.loserMatchTempKey;
    }
  }

  // 6. Grand Final & optional Grand Final Reset
  const grandFinal: GeneratedMatchBlueprint = {
    tempKey: gfKey,
    bracket_type: 'grand_final',
    round: 1,
    match_order: 1,
    participant1_id: null,
    participant2_id: null,
    score_1: null,
    score_2: null,
    winner_id: null,
    nextMatchTempKey: hasGrandFinalReset ? gfrKey : null,
    next_match_slot: hasGrandFinalReset ? 1 : null,
    loserMatchTempKey: null,
    loser_match_slot: null,
  };

  const result: GeneratedMatchBlueprint[] = [
    ...Array.from(byKey.values()).filter((m) => m.bracket_type === 'winner'),
    ...Array.from(byKey.values())
      .filter((m) => m.bracket_type === 'loser')
      .sort((a, b) => a.round - b.round || a.match_order - b.match_order),
    grandFinal,
  ];

  if (hasGrandFinalReset) {
    result.push({
      tempKey: gfrKey,
      bracket_type: 'grand_final_reset',
      round: 2,
      match_order: 1,
      participant1_id: null,
      participant2_id: null,
      score_1: null,
      score_2: null,
      winner_id: null,
      nextMatchTempKey: null,
      next_match_slot: null,
      loserMatchTempKey: null,
      loser_match_slot: null,
    });
  }

  return result;
}

/**
 * Pure helper that supports:
 * 1. Immediate winner selection WITHOUT requiring scores (`score1 = null, score2 = null`).
 * 2. Editing scores BEFORE a winner is chosen (`winnerId = null`, scores saved on the match).
 * 3. Editing scores AFTER a winner is chosen, or switching the winner in case of human error,
 *    automatically cascading updates & rollbacks down BOTH `next_match_id` and `loser_match_id`.
 * 4. Grand Final Game 1 -> Grand Final Reset activation & deactivation.
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

  const resolvedLoserId: string | null =
    resolvedWinnerId === match.participant1_id
      ? match.participant2_id
      : resolvedWinnerId === match.participant2_id
        ? match.participant1_id
        : null;

  const originalById = new Map<string, TournamentMatch>();
  const matchById = new Map<string, TournamentMatch>();
  for (const m of allMatches) {
    originalById.set(m.id, m);
    matchById.set(m.id, { ...m });
  }

  const updatedCurrent = matchById.get(match.id);
  if (updatedCurrent) {
    updatedCurrent.score_1 = score1;
    updatedCurrent.score_2 = score2;
    updatedCurrent.winner_id = resolvedWinnerId;
  }

  const clearResetMatch = (resetMatchId: string) => {
    const resetMatch = matchById.get(resetMatchId);
    if (!resetMatch || resetMatch.bracket_type !== 'grand_final_reset') return;
    resetMatch.participant1_id = null;
    resetMatch.participant2_id = null;
    resetMatch.winner_id = null;
    resetMatch.score_1 = null;
    resetMatch.score_2 = null;
  };

  const visitedSlots = new Set<string>();
  const assignMatchSlot = (
    targetMatchId: string | null | undefined,
    slot: 1 | 2 | null | undefined,
    nextParticipantId: string | null
  ) => {
    if (!targetMatchId || !slot) return;
    const visitKey = `${targetMatchId}:${slot}:${nextParticipantId ?? 'null'}`;
    if (visitedSlots.has(visitKey)) return;
    visitedSlots.add(visitKey);

    const target = matchById.get(targetMatchId);
    if (!target) return;

    const slotField = slot === 1 ? 'participant1_id' : 'participant2_id';
    const prevParticipantId = target[slotField];
    if (prevParticipantId === nextParticipantId) return;

    const hadResult =
      prevParticipantId !== null &&
      (target.winner_id !== null ||
        target.score_1 !== null ||
        target.score_2 !== null);

    target[slotField] = nextParticipantId;

    if (hadResult) {
      target.winner_id = null;
      target.score_1 = null;
      target.score_2 = null;

      if (target.bracket_type === 'grand_final') {
        if (target.next_match_id) {
          clearResetMatch(target.next_match_id);
        }
      } else {
        if (target.next_match_id && target.next_match_slot) {
          assignMatchSlot(target.next_match_id, target.next_match_slot, null);
        }
        if (target.loser_match_id && target.loser_match_slot) {
          assignMatchSlot(target.loser_match_id, target.loser_match_slot, null);
        }
      }
    }
  };

  const currentBracketType = match.bracket_type ?? 'winner';

  if (currentBracketType === 'grand_final') {
    if (match.next_match_id) {
      const resetMatch = matchById.get(match.next_match_id);
      if (resetMatch && resetMatch.bracket_type === 'grand_final_reset') {
        if (resolvedWinnerId === match.participant2_id) {
          const participantsChanged =
            resetMatch.participant1_id !== match.participant1_id ||
            resetMatch.participant2_id !== match.participant2_id;
          resetMatch.participant1_id = match.participant1_id;
          resetMatch.participant2_id = match.participant2_id;
          if (participantsChanged) {
            resetMatch.winner_id = null;
            resetMatch.score_1 = null;
            resetMatch.score_2 = null;
          }
        } else {
          clearResetMatch(resetMatch.id);
        }
      }
    }
  } else if (currentBracketType !== 'grand_final_reset') {
    if (match.next_match_id && match.next_match_slot) {
      assignMatchSlot(match.next_match_id, match.next_match_slot, resolvedWinnerId);
    }
    if (match.loser_match_id && match.loser_match_slot) {
      assignMatchSlot(match.loser_match_id, match.loser_match_slot, resolvedLoserId);
    }
  }

  // Build deduplicated downstreamPatches by diffing modified matches against original snapshot
  const downstreamPatches: DownstreamMatchPatch[] = [];
  for (const [mId, simulated] of matchById.entries()) {
    if (mId === match.id) continue;
    const orig = originalById.get(mId);
    if (!orig) continue;

    const patch: DownstreamMatchPatch['patch'] = {};
    let changed = false;

    if (simulated.participant1_id !== orig.participant1_id) {
      patch.participant1_id = simulated.participant1_id;
      changed = true;
    }
    if (simulated.participant2_id !== orig.participant2_id) {
      patch.participant2_id = simulated.participant2_id;
      changed = true;
    }
    if (simulated.winner_id !== orig.winner_id) {
      patch.winner_id = simulated.winner_id;
      changed = true;
    }
    if (simulated.score_1 !== orig.score_1) {
      patch.score_1 = simulated.score_1;
      changed = true;
    }
    if (simulated.score_2 !== orig.score_2) {
      patch.score_2 = simulated.score_2;
      changed = true;
    }

    if (changed) {
      downstreamPatches.push({ matchId: mId, patch });
    }
  }

  // Determine tournament completion state
  const simulatedMatches = Array.from(matchById.values());
  const isDoubleElimination = simulatedMatches.some(
    (m) =>
      m.bracket_type === 'grand_final' ||
      m.bracket_type === 'grand_final_reset' ||
      m.bracket_type === 'loser'
  );

  let isCompleted = false;
  if (isDoubleElimination) {
    const gf = simulatedMatches.find((m) => m.bracket_type === 'grand_final');
    const gfr = simulatedMatches.find((m) => m.bracket_type === 'grand_final_reset');
    if (gf?.winner_id) {
      if (gf.winner_id === gf.participant1_id || !gfr) {
        isCompleted = true;
      } else if (gf.winner_id === gf.participant2_id) {
        isCompleted = Boolean(gfr.winner_id);
      }
    }
  } else {
    const maxRound = simulatedMatches.reduce((max, m) => Math.max(max, m.round), match.round);
    const finalMatch =
      simulatedMatches.find((m) => m.round === maxRound && m.next_match_id === null) ??
      simulatedMatches.find((m) => m.round === maxRound);
    isCompleted = Boolean(finalMatch?.winner_id);
  }

  return {
    matchUpdate: {
      score_1: score1,
      score_2: score2,
      winner_id: resolvedWinnerId,
      ...(court !== undefined ? { court } : {}),
    },
    downstreamPatches,
    nextTournamentStatus: isCompleted ? 'completed' : 'in_progress',
  };
}

export interface TournamentFormatDraft {
  format: TournamentFormat;
  hasGrandFinalReset: boolean;
}

let pendingTournamentFormatDraft: TournamentFormatDraft | null = null;

/**
 * Store a temporary tournament format selection when handing off from a session shuffle modal
 * to the Customize & Seed tournament dialog.
 */
export function setPendingTournamentFormatDraft(
  draft: TournamentFormatDraft | null
): void {
  pendingTournamentFormatDraft = draft;
}

/**
 * Read the pending tournament format draft without clearing it (StrictMode-safe).
 */
export function getPendingTournamentFormatDraft(): TournamentFormatDraft | null {
  return pendingTournamentFormatDraft;
}

/**
 * Consume and clear the pending tournament format draft once initialized.
 */
export function consumePendingTournamentFormatDraft(): TournamentFormatDraft | null {
  const draft = pendingTournamentFormatDraft;
  pendingTournamentFormatDraft = null;
  return draft;
}
