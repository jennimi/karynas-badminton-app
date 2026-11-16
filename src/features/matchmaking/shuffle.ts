import type { MemberColor, ParticipantWithMember } from '../../shared/types';
import { formatDate } from '../../shared/utils/format';
import { cleanName, nameKey } from '../../shared/utils/nameParser';
import type { DraftDoublesPair } from '../tournaments/types';

export type OddPlayerMode = 'bench' | 'double_up' | 'guest';

export interface ShufflePlayer {
  key: string;
  name: string;
  memberId: string | null;
  emoji?: string | null;
  color?: MemberColor | null;
  isGuest?: boolean;
}

export interface ShuffledPairSlot {
  id: string;
  player1: ShufflePlayer;
  player2: ShufflePlayer;
}

export type ShuffleLocation =
  | { area: 'pair'; pairIndex: number; slot: 1 | 2 }
  | { area: 'bench'; benchIndex: number };

export interface ShuffleResult {
  pairs: ShuffledPairSlot[];
  bench: ShufflePlayer[];
  doubledUpPlayerKey: string | null;
}

export const ODD_GUEST_KEY = 'guest-odd-partner';

/**
 * Convert session participants (plus any modal-only extra players) into a deduplicated pool.
 */
export function buildSessionShufflePool(
  participants: ParticipantWithMember[],
  extraPlayers: ShufflePlayer[] = []
): ShufflePlayer[] {
  const seen = new Set<string>();
  const pool: ShufflePlayer[] = [];

  const sortedSessionPlayers = [...participants]
    .map((p) => p.member)
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const m of sortedSessionPlayers) {
    const key = `member:${m.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push({
      key,
      name: m.name,
      memberId: m.id,
      emoji: m.emoji,
      color: m.color,
      isGuest: false,
    });
  }

  for (const extra of extraPlayers) {
    if (seen.has(extra.key)) continue;
    seen.add(extra.key);
    pool.push(extra);
  }

  return pool;
}

/**
 * Build a ShufflePlayer from either an existing Member or a custom Guest name.
 */
export function createShufflePlayerFromInput(
  rawName: string,
  members: { id: string; name: string; emoji?: string | null; color?: MemberColor | null }[]
): ShufflePlayer | null {
  const cleaned = cleanName(rawName);
  if (!cleaned) return null;

  const targetKey = nameKey(cleaned);
  const matched = members.find((m) => nameKey(m.name) === targetKey);
  if (matched) {
    return {
      key: `member:${matched.id}`,
      name: matched.name,
      memberId: matched.id,
      emoji: matched.emoji,
      color: matched.color,
      isGuest: false,
    };
  }

  return {
    key: `guest:${targetKey}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleaned,
    memberId: null,
    isGuest: true,
  };
}

function fisherYatesShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function makePairId(index: number, p1: ShufflePlayer, p2: ShufflePlayer): string {
  return `pair-${index}-${p1.key}-${p2.key}`;
}

function applyOddResolution(
  basePairs: ShuffledPairSlot[],
  leftoverPlayer: ShufflePlayer,
  oddMode: OddPlayerMode,
  options?: { guestName?: string; preferredDoubleUpKey?: string | null }
): ShuffleResult {
  const pairs = basePairs.map((pair) => ({ ...pair }));

  if (oddMode === 'double_up' && pairs.length >= 1) {
    const basePlayers = pairs.flatMap((pair) => [pair.player1, pair.player2]);
    const preferred = options?.preferredDoubleUpKey
      ? basePlayers.find(
          (p) => p.key === options.preferredDoubleUpKey && p.key !== leftoverPlayer.key
        )
      : undefined;

    const candidates = basePlayers.filter((p) => p.key !== leftoverPlayer.key);
    const chosen =
      preferred ??
      (candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : null);

    if (chosen) {
      pairs.push({
        id: makePairId(pairs.length + 1, leftoverPlayer, chosen),
        player1: leftoverPlayer,
        player2: chosen,
      });
      return {
        pairs,
        bench: [],
        doubledUpPlayerKey: chosen.key,
      };
    }
  }

  if (oddMode === 'guest') {
    const guestDisplay = cleanName(options?.guestName ?? '') || 'Guest Partner';
    const guestPlayer: ShufflePlayer = {
      key: ODD_GUEST_KEY,
      name: guestDisplay,
      memberId: null,
      isGuest: true,
    };
    pairs.push({
      id: makePairId(pairs.length + 1, leftoverPlayer, guestPlayer),
      player1: leftoverPlayer,
      player2: guestPlayer,
    });
    return {
      pairs,
      bench: [],
      doubledUpPlayerKey: null,
    };
  }

  return {
    pairs,
    bench: [leftoverPlayer],
    doubledUpPlayerKey: null,
  };
}

/**
 * Randomly pair a pool of players into doubles teams using Fisher-Yates shuffling.
 * Odd player counts are handled cleanly by the selected `oddMode`.
 */
export function generateShuffledPairs(
  pool: ShufflePlayer[],
  oddMode: OddPlayerMode,
  options?: { guestName?: string; preferredDoubleUpKey?: string | null }
): ShuffleResult {
  if (pool.length === 0) {
    return { pairs: [], bench: [], doubledUpPlayerKey: null };
  }

  const shuffled = fisherYatesShuffle(pool);
  const pairCount = Math.floor(shuffled.length / 2);
  const basePairs: ShuffledPairSlot[] = [];

  for (let i = 0; i < pairCount; i++) {
    const p1 = shuffled[i * 2];
    const p2 = shuffled[i * 2 + 1];
    basePairs.push({
      id: makePairId(i + 1, p1, p2),
      player1: p1,
      player2: p2,
    });
  }

  if (shuffled.length % 2 === 1) {
    const leftover = shuffled[shuffled.length - 1];
    return applyOddResolution(basePairs, leftover, oddMode, options);
  }

  return {
    pairs: basePairs,
    bench: [],
    doubledUpPlayerKey: null,
  };
}

/**
 * Switch the odd-player strategy (or update the guest name / doubled-up player)
 * while preserving the user's current pairs as much as possible.
 */
export function reapplyOddMode(
  current: ShuffleResult,
  pool: ShufflePlayer[],
  nextMode: OddPlayerMode,
  options?: { guestName?: string; preferredDoubleUpKey?: string | null }
): ShuffleResult {
  if (pool.length % 2 === 0) {
    return generateShuffledPairs(pool, nextMode, options);
  }

  // Case 1: Currently has 1 player on bench
  if (current.bench.length === 1) {
    return applyOddResolution(current.pairs, current.bench[0], nextMode, options);
  }

  // Case 2: Currently has a synthetic odd-guest pair
  const guestPairIdx = current.pairs.findIndex(
    (p) => p.player1.key === ODD_GUEST_KEY || p.player2.key === ODD_GUEST_KEY
  );
  if (guestPairIdx !== -1) {
    const targetPair = current.pairs[guestPairIdx];
    const leftover =
      targetPair.player1.key === ODD_GUEST_KEY ? targetPair.player2 : targetPair.player1;
    const basePairs = current.pairs.filter((_, idx) => idx !== guestPairIdx);
    return applyOddResolution(basePairs, leftover, nextMode, options);
  }

  // Case 3: Currently has a doubled-up player
  if (current.doubledUpPlayerKey) {
    const counts = getShufflePlayerCounts(current.pairs);
    const doubledKey = Array.from(counts.entries()).find(([, count]) => count >= 2)?.[0];
    if (doubledKey) {
      // Remove the last pair containing the doubled player, leaving their partner as the odd player
      let removedPairIdx = -1;
      for (let i = current.pairs.length - 1; i >= 0; i--) {
        const pair = current.pairs[i];
        if (pair.player1.key === doubledKey || pair.player2.key === doubledKey) {
          removedPairIdx = i;
          break;
        }
      }
      if (removedPairIdx !== -1) {
        const removedPair = current.pairs[removedPairIdx];
        const leftover =
          removedPair.player1.key === doubledKey ? removedPair.player2 : removedPair.player1;
        const basePairs = current.pairs.filter((_, idx) => idx !== removedPairIdx);
        return applyOddResolution(basePairs, leftover, nextMode, options);
      }
    }
  }

  return generateShuffledPairs(pool, nextMode, options);
}

/**
 * Count how many pairs each player key currently appears in.
 */
export function getShufflePlayerCounts(pairs: ShuffledPairSlot[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const pair of pairs) {
    counts.set(pair.player1.key, (counts.get(pair.player1.key) ?? 0) + 1);
    if (pair.player2.key !== pair.player1.key) {
      counts.set(pair.player2.key, (counts.get(pair.player2.key) ?? 0) + 1);
    }
  }
  return counts;
}

function getPlayerAt(result: ShuffleResult, loc: ShuffleLocation): ShufflePlayer | null {
  if (loc.area === 'bench') {
    return result.bench[loc.benchIndex] ?? null;
  }
  const pair = result.pairs[loc.pairIndex];
  if (!pair) return null;
  return loc.slot === 1 ? pair.player1 : pair.player2;
}

function setPlayerAt(
  pairs: ShuffledPairSlot[],
  bench: ShufflePlayer[],
  loc: ShuffleLocation,
  player: ShufflePlayer
): void {
  if (loc.area === 'bench') {
    bench[loc.benchIndex] = player;
    return;
  }
  const target = pairs[loc.pairIndex];
  if (!target) return;
  if (loc.slot === 1) {
    target.player1 = player;
  } else {
    target.player2 = player;
  }
  target.id = makePairId(loc.pairIndex + 1, target.player1, target.player2);
}

/**
 * Swap two player positions (either between two pairs or between a pair and the bench).
 * Rejects swaps that would pair a player with themselves on the same team.
 */
export function swapShuffleLocations(
  result: ShuffleResult,
  from: ShuffleLocation,
  to: ShuffleLocation
): { result: ShuffleResult; error?: string } {
  if (
    from.area === to.area &&
    (from.area === 'bench'
      ? to.area === 'bench' && from.benchIndex === to.benchIndex
      : to.area === 'pair' && from.pairIndex === to.pairIndex && from.slot === to.slot)
  ) {
    return { result };
  }

  const playerFrom = getPlayerAt(result, from);
  const playerTo = getPlayerAt(result, to);
  if (!playerFrom || !playerTo) {
    return { result };
  }

  const nextPairs = result.pairs.map((p) => ({ ...p }));
  const nextBench = [...result.bench];

  setPlayerAt(nextPairs, nextBench, from, playerTo);
  setPlayerAt(nextPairs, nextBench, to, playerFrom);

  const hasSelfPair = nextPairs.some((p) => p.player1.key === p.player2.key);
  if (hasSelfPair) {
    return {
      result,
      error: 'A player cannot be partnered with themselves on the same pair.',
    };
  }

  const counts = getShufflePlayerCounts(nextPairs);
  const doubledKey = Array.from(counts.entries()).find(([, count]) => count >= 2)?.[0] ?? null;

  return {
    result: {
      pairs: nextPairs,
      bench: nextBench,
      doubledUpPlayerKey: doubledKey,
    },
  };
}

/**
 * Convert shuffled pairs to DraftDoublesPair[] for Tournament creation.
 */
export function toDraftDoublesPairs(pairs: ShuffledPairSlot[]): DraftDoublesPair[] {
  return pairs.map((pair, idx) => ({
    key: `${pair.id}-${idx}`,
    player1Name: pair.player1.name,
    player1MemberId: pair.player1.memberId,
    player2Name: pair.player2.name,
    player2MemberId: pair.player2.memberId,
  }));
}

/**
 * Format shuffled pairs and any bench/bye players for pasting into WhatsApp.
 */
export function formatShuffleForWhatsApp({
  sessionTitle,
  sessionDate,
  pairs,
  bench,
}: {
  sessionTitle: string;
  sessionDate: string;
  pairs: ShuffledPairSlot[];
  bench: ShufflePlayer[];
}): string {
  const headerDate = formatDate(sessionDate, 'short');
  const title = sessionTitle.trim() ? `${sessionTitle.trim()} (${headerDate})` : headerDate;

  const lines = [`🏸 *${title} — Doubles Pairs*`, ''];
  pairs.forEach((pair, index) => {
    lines.push(`${index + 1}. ${pair.player1.name} & ${pair.player2.name}`);
  });

  if (bench.length > 0) {
    lines.push('');
    lines.push(`🪑 Bench / Bye: ${bench.map((b) => b.name).join(', ')}`);
  }

  return lines.join('\n');
}
