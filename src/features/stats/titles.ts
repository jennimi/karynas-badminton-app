import { RULES, type Duo, type MemberStats } from './compute';

// Fun titles earned from playing stats. They are worked out, never stored, so they move around as games
// are played: the "best at X" titles belong to whoever is ahead right now (ties share it), while the
// "reach X" titles belong to everyone who gets there. Stat titles need RULES.minGames games first.

export type TitleKey =
  | 'topDog' | 'winMachine' | 'streak' | 'wall' | 'smash' | 'comeback' | 'butterfly' | 'duo' | 'clutch' | 'neverMisses';

export interface TitleDef {
  key: TitleKey;
  emoji: string;
  name: string;
  /** how to earn it, in plain words */
  how: string;
}

export const TITLES: TitleDef[] = [
  { key: 'topDog', emoji: '🏆', name: 'Top Dog', how: 'Most wins in the group (at least 3).' },
  { key: 'winMachine', emoji: '🤖', name: 'Win Machine', how: 'Best win rate in the group, and at least 60%.' },
  { key: 'streak', emoji: '🔥', name: 'Winning Streak', how: 'Win 4 games in a row.' },
  { key: 'wall', emoji: '🧱', name: 'The Wall', how: 'Fewest points conceded per game: hard to score against.' },
  { key: 'smash', emoji: '💥', name: 'Power Smash', how: 'The biggest winning margin in a single game (at least 10 points).' },
  { key: 'comeback', emoji: '👑', name: 'Comeback Royalty', how: 'Lose 3 in a row, then bounce back with 2 wins in a row. The bigger the run, the better.' },
  { key: 'butterfly', emoji: '🦋', name: 'Social Butterfly', how: 'Partnered with the most different people (at least 5).' },
  { key: 'duo', emoji: '🤝', name: 'Dynamic Duo', how: 'Half of the best pair: 4+ games together and a 60%+ win rate.' },
  { key: 'clutch', emoji: '🎯', name: 'Clutch', how: `Most wins by ${RULES.closeMargin} points or fewer (at least 2).` },
  { key: 'neverMisses', emoji: '📅', name: 'Never Misses', how: 'Longest run of back-to-back sessions attended (at least 5).' },
];

export interface Held {
  key: TitleKey;
  /** the number behind it, ready to show */
  value: string;
}

export interface TitleResult {
  byMember: Map<string, Held[]>;
  holders: Map<TitleKey, { ids: string[]; value: (id: string) => string }>;
}

/** Everyone tied on the best score, if that score is good enough. */
function best<T>(items: T[], score: (x: T) => number, min: number, lowerIsBetter = false): T[] {
  if (items.length === 0) return [];
  const s = (x: T) => (lowerIsBetter ? -score(x) : score(x));
  const top = Math.max(...items.map(s));
  const goodEnough = lowerIsBetter ? -top <= min : top >= min;
  return goodEnough ? items.filter((x) => s(x) === top) : [];
}

export function computeTitles(
  stats: Map<string, MemberStats>,
  duos: Duo[],
  attendance: Map<string, { longest: number; current: number }>
): TitleResult {
  const byMember = new Map<string, Held[]>();
  const holders: TitleResult['holders'] = new Map();
  const give = (key: TitleKey, ids: string[], value: (id: string) => string) => {
    if (ids.length === 0) return;
    holders.set(key, { ids, value });
    for (const id of ids) byMember.set(id, [...(byMember.get(id) ?? []), { key, value: value(id) }]);
  };

  const q = [...stats.values()].filter((m) => m.games >= RULES.minGames);
  const st = (id: string) => stats.get(id)!;

  give('topDog', best(q, (m) => m.wins, 3).map((m) => m.id), (id) => `${st(id).wins} wins`);
  give('winMachine', best(q, (m) => m.winRate, 0.6).map((m) => m.id), (id) => `${Math.round(st(id).winRate * 100)}% wins`);
  give('streak', q.filter((m) => m.longestStreak >= 4).map((m) => m.id), (id) => `${st(id).longestStreak} wins in a row`);
  give('wall', best(q, (m) => m.avgAgainst, Infinity, true).map((m) => m.id), (id) => `${st(id).avgAgainst.toFixed(1)} points against per game`);
  give('smash', best(q, (m) => m.biggestWin?.margin ?? 0, 10).map((m) => m.id), (id) => {
    const w = st(id).biggestWin!;
    return `won ${w.scoreFor}–${w.scoreAgainst}`;
  });
  give('comeback', best(q.filter((m) => m.comeback), (m) => m.comeback!.lost + m.comeback!.won, 5).map((m) => m.id), (id) => {
    const c = st(id).comeback!;
    return `lost ${c.lost} in a row, then won ${c.won}`;
  });
  give('butterfly', best(q, (m) => m.partners.size, 5).map((m) => m.id), (id) => `${st(id).partners.size} different partners`);
  give('clutch', best(q, (m) => m.closeWins, 2).map((m) => m.id), (id) => `${st(id).closeWins} close wins`);

  const topDuo = best(
    duos.filter((d) => d.games >= RULES.minDuoGames + 1),
    (d) => d.winRate * 1000 + d.games, // best win rate first, more games together breaks a tie
    600
  )[0];
  if (topDuo) {
    give('duo', [topDuo.a, topDuo.b], () => `${Math.round(topDuo.winRate * 100)}% together (${topDuo.wins}–${topDuo.games - topDuo.wins})`);
  }

  const att = [...attendance.entries()].map(([id, a]) => ({ id, longest: a.longest }));
  give('neverMisses', best(att, (a) => a.longest, 5).map((a) => a.id), (id) => `${attendance.get(id)!.longest} sessions in a row`);

  return { byMember, holders };
}
