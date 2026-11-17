import { RULES, type Duo, type MemberStats } from './compute';

// Fun titles earned from playing stats. They are worked out, never stored, so they move around as games
// are played: the "best at X" titles belong to whoever is ahead right now (ties share it), while the
// "reach X" titles belong to everyone who gets there. Stat titles need RULES.minGames games first.

export type TitleKey =
  // the originals
  | 'topDog' | 'winMachine' | 'streak' | 'wall' | 'smash' | 'comeback' | 'butterfly' | 'duo' | 'clutch' | 'neverMisses'
  // harder
  | 'untouchable' | 'goat' | 'giantKiller' | 'ironLung' | 'flawless' | 'sharpshooter' | 'onFire' | 'veteran'
  // the hall of shame (visible)
  | 'participation' | 'coldCase'
  // hidden: nobody knows they exist until they unlock one
  | 'ripPieces' | 'bagel' | 'lamb' | 'jinx' | 'phoenix' | 'coinFlip' | 'touchGrass' | 'nemesis' | 'rollercoaster'
  | 'rideOrDie' | 'everyone' | 'freefall' | 'cursed' | 'alwaysTheBridesmaid' | 'fullSend';

export interface TitleDef {
  key: TitleKey;
  emoji: string;
  name: string;
  /** how to earn it, in plain words */
  how: string;
  /** Hidden titles show as "???" with only a cryptic hint until someone unlocks them. */
  hidden?: boolean;
  hint?: string;
  /** harder titles get a flame tag in the lists */
  hard?: boolean;
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

  // ---- harder
  { key: 'untouchable', emoji: '💎', name: 'Untouchable', how: 'Win 8 games in a row. Eight. Nobody stopped you.', hard: true },
  { key: 'goat', emoji: '🐐', name: 'The GOAT', how: 'Rating of 1120+ with a 65%+ win rate over at least 20 games. Held by whoever is rated highest.', hard: true },
  { key: 'giantKiller', emoji: '🗡️', name: 'Giant Killer', how: 'Win 4 games your team was only given a 35% chance (or less) of winning.', hard: true },
  { key: 'ironLung', emoji: '🫁', name: 'Iron Lung', how: 'Play 8+ games in a single session. Hydration is for the weak.', hard: true },
  { key: 'flawless', emoji: '✨', name: 'Flawless Night', how: 'Win every game of a session, with at least 5 games played that night.', hard: true },
  { key: 'sharpshooter', emoji: '🔭', name: 'Sharpshooter', how: 'Win 5 close games (2 points or fewer) AND lose no more close games than you win.', hard: true },
  { key: 'onFire', emoji: '☄️', name: 'Main Character', how: 'Gain 60+ rating points over your last 10 games. The group is your background cast.', hard: true },
  { key: 'veteran', emoji: '🎖️', name: 'Court Veteran', how: 'Play 50 scored games. You live here now.', hard: true },

  // ---- the hall of shame (visible, because we love you)
  { key: 'participation', emoji: '🥉', name: 'Participation Trophy', how: 'Most losses in the group (at least 5). Thank you for your service.' },
  { key: 'coldCase', emoji: '🥶', name: 'Cold Case', how: 'Lose 4 games in a row. Someone check on them.' },

  // ---- hidden
  { key: 'ripPieces', emoji: '🪦', name: 'Rest In Pieces', how: 'Lose 6 games in a row.', hidden: true, hint: 'Requires a spectacularly bad day. And then some more.' },
  { key: 'bagel', emoji: '🥯', name: 'Fresh Bagel', how: 'Lose a game while scoring 5 points or fewer.', hidden: true, hint: 'Served hot. Mostly zeros.' },
  { key: 'lamb', emoji: '🐑', name: 'Sacrificial Lamb', how: 'Get beaten by 15+ points in a single game.', hidden: true, hint: 'It was not close. It was not even a game.' },
  { key: 'jinx', emoji: '🐈‍⬛', name: 'Walking Jinx', how: 'Play 4+ games with the same partner and never win one.', hidden: true, hint: 'Somebody is bad luck. Possibly both of you.' },
  { key: 'phoenix', emoji: '🐦‍🔥', name: 'Phoenix', how: 'Lose 5 in a row, then win 4 in a row.', hidden: true, hint: 'Rise from the ashes. Requires ashes first.' },
  { key: 'coinFlip', emoji: '🪙', name: 'Coin Flip Merchant', how: 'Win 4 close games AND lose 4 close games (2 points or fewer).', hidden: true, hint: 'Lives on the knife-edge. Both ways.' },
  { key: 'touchGrass', emoji: '🌱', name: 'Touch Grass', how: 'Attend 10 sessions in a row. Please go outside (not a court).', hidden: true, hint: 'Show up. Again. And again. And again.' },
  { key: 'nemesis', emoji: '😈', name: 'Personal Nemesis Arc', how: 'Lose 5+ games against the same person and never beat them.', hidden: true, hint: 'There is someone you cannot beat. You know who.' },
  { key: 'rollercoaster', emoji: '🎢', name: 'Emotional Rollercoaster', how: 'Your rating swings 80+ points between your best and worst moment.', hidden: true, hint: 'Peaks. Valleys. Screaming.' },
  { key: 'rideOrDie', emoji: '💍', name: 'Ride or Die', how: 'Play 10+ doubles games and 80%+ of them with the same partner.', hidden: true, hint: 'Loyalty to a fault.' },
  { key: 'everyone', emoji: '🌈', name: 'Pairs With Everyone', how: 'Partner with 10 different people.', hidden: true, hint: 'Knows the whole group. Intimately.' },
  { key: 'freefall', emoji: '🪂', name: 'Terminal Velocity', how: 'Lose 60+ rating points over your last 10 games.', hidden: true, hint: 'The opposite of a glow-up.' },
  { key: 'cursed', emoji: '🫠', name: 'Built Different (Wrong Way)', how: 'A win rate of 25% or lower over 12+ games.', hidden: true, hint: 'Statistically remarkable. In its own way.' },
  { key: 'alwaysTheBridesmaid', emoji: '💐', name: 'Always the Bridesmaid', how: 'Lose at least 5 more close games (2 points or fewer) than you win.', hidden: true, hint: 'So close. So many times.' },
  { key: 'fullSend', emoji: '🚀', name: 'Full Send', how: 'Win 3 or more games by 10+ points each. Mercy is a myth.', hidden: true, hint: 'Doesn’t know what “easy does it” means.' },
];

export const titleByKey = (key: TitleKey) => TITLES.find((t) => t.key === key)!;

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


  // ---- harder
  give('untouchable', q.filter((m) => m.longestStreak >= 8).map((m) => m.id), (id) => `${st(id).longestStreak} wins in a row`);
  const goats = q.filter((m) => m.games >= 20 && m.winRate >= 0.65 && m.rating >= 1120);
  give('goat', best(goats, (m) => m.rating, 0).map((m) => m.id), (id) => `rated ${Math.round(st(id).rating)}`);
  give('giantKiller', q.filter((m) => m.upsetWins >= 4).map((m) => m.id), (id) => `${st(id).upsetWins} upset wins`);
  give('ironLung', q.filter((m) => m.maxGamesInSession >= 8).map((m) => m.id), (id) => `${st(id).maxGamesInSession} games in one night`);
  give('flawless', q.filter((m) => m.perfectSessions >= 1 && m.maxWinsInSession >= 5).map((m) => m.id), (id) => `${st(id).perfectSessions} perfect night${st(id).perfectSessions === 1 ? '' : 's'}`);
  give('sharpshooter', q.filter((m) => m.closeWins >= 5 && m.closeWins >= m.closeLosses).map((m) => m.id), (id) => `${st(id).closeWins} close wins vs ${st(id).closeLosses} close losses`);
  give('onFire', q.filter((m) => m.games >= 10 && m.recentForm >= 60).map((m) => m.id), (id) => `+${Math.round(st(id).recentForm)} in 10 games`);
  give('veteran', q.filter((m) => m.games >= 50).map((m) => m.id), (id) => `${st(id).games} games`);

  // ---- hall of shame
  give('participation', best(q, (m) => m.losses, 5).map((m) => m.id), (id) => `${st(id).losses} losses`);
  give('coldCase', q.filter((m) => m.longestLoseStreak >= 4).map((m) => m.id), (id) => `${st(id).longestLoseStreak} losses in a row`);

  // ---- hidden (these skip the usual minimum: some people unlock them on a very bad day)
  const any = [...stats.values()].filter((m) => m.games > 0);
  give('ripPieces', any.filter((m) => m.longestLoseStreak >= 6).map((m) => m.id), (id) => `${st(id).longestLoseStreak} losses in a row`);
  give('bagel', any.filter((m) => m.bagels >= 1).map((m) => m.id), (id) => `${st(id).bagels} bagel${st(id).bagels === 1 ? '' : 's'} (${st(id).fewestPoints} points at the lowest)`);
  give('lamb', any.filter((m) => (m.biggestLoss?.margin ?? 0) >= 15).map((m) => m.id), (id) => `lost ${st(id).biggestLoss!.scoreFor}–${st(id).biggestLoss!.scoreAgainst}`);
  const jinxed = (m: MemberStats) => [...m.partners.entries()].find(([, p]) => p.games >= 4 && p.wins === 0);
  give('jinx', any.filter((m) => jinxed(m)).map((m) => m.id), (id) => `${jinxed(st(id))![1].games} games with the same partner, 0 wins`);
  give('phoenix', any.filter((m) => m.comeback && m.comeback.lost >= 5 && m.comeback.won >= 4).map((m) => m.id), (id) => `lost ${st(id).comeback!.lost}, then won ${st(id).comeback!.won}`);
  give('coinFlip', any.filter((m) => m.closeWins >= 4 && m.closeLosses >= 4).map((m) => m.id), (id) => `${st(id).closeWins} close wins, ${st(id).closeLosses} close losses`);
  give('touchGrass', [...attendance.entries()].filter(([, a]) => a.longest >= 10).map(([id]) => id), (id) => `${attendance.get(id)!.longest} sessions in a row`);
  const nemesisOf = (m: MemberStats) => [...m.rivals.entries()].find(([, r]) => r.games >= 5 && r.wins === 0);
  give('nemesis', any.filter((m) => nemesisOf(m)).map((m) => m.id), (id) => `${nemesisOf(st(id))![1].games}–0 down against one person`);
  give('rollercoaster', any.filter((m) => m.games >= 10 && m.peakRating - m.lowRating >= 80).map((m) => m.id), (id) => `${Math.round(st(id).lowRating)} to ${Math.round(st(id).peakRating)}`);
  const loyalty = (m: MemberStats) => {
    const total = [...m.partners.values()].reduce((s, p) => s + p.games, 0);
    const top = Math.max(0, ...[...m.partners.values()].map((p) => p.games));
    return { total, top };
  };
  give('rideOrDie', any.filter((m) => { const l = loyalty(m); return l.total >= 10 && l.top / l.total >= 0.8; }).map((m) => m.id), (id) => `${loyalty(st(id)).top} of ${loyalty(st(id)).total} doubles games with one partner`);
  give('everyone', any.filter((m) => m.partners.size >= 10).map((m) => m.id), (id) => `${st(id).partners.size} partners`);
  give('freefall', any.filter((m) => m.games >= 10 && m.recentForm <= -60).map((m) => m.id), (id) => `${Math.round(st(id).recentForm)} in 10 games`);
  give('cursed', any.filter((m) => m.games >= 12 && m.winRate <= 0.25).map((m) => m.id), (id) => `${Math.round(st(id).winRate * 100)}% wins over ${st(id).games} games`);
  give('alwaysTheBridesmaid', any.filter((m) => m.closeLosses - m.closeWins >= 5).map((m) => m.id), (id) => `${st(id).closeLosses} close losses vs ${st(id).closeWins} wins`);
  give('fullSend', any.filter((m) => m.blowoutWins >= 3).map((m) => m.id), (id) => `${st(id).blowoutWins} wins by 10+`);

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
