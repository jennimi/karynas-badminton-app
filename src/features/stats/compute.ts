// Rally's stats engine: plain functions (no React, no network) so they are easy to test.
// Everything is worked out from scored matches (matches + match_players). Nothing is stored.

export interface Game {
  id: string;
  sessionId: string;
  /** date of the session, YYYY-MM-DD */
  date: string;
  round: number;
  createdAt: string;
  teamA: string[]; // member ids (1 = singles, 2 = doubles)
  teamB: string[];
  scoreA: number;
  scoreB: number;
}

/** Fairness rules in one place. A rate from 2 games means little, so rankings wait for a minimum. */
export const RULES = {
  /** games before someone can be ranked on win rate / rating / titles */
  minGames: 5,
  /** games together before a duo can be ranked */
  minDuoGames: 3,
  /** a "close" win is by this many points or fewer */
  closeMargin: 2,
  /** Elo-style rating: everyone starts here, K = how far one game can move it */
  ratingStart: 1000,
  ratingK: 24,
};

export interface MemberStats {
  id: string;
  games: number;
  wins: number;
  losses: number;
  /** 0..1 */
  winRate: number;
  currentStreak: number;
  longestStreak: number;
  pointsFor: number;
  pointsAgainst: number;
  avgAgainst: number;
  biggestWin: { margin: number; scoreFor: number; scoreAgainst: number; gameId: string } | null;
  closeWins: number;
  /** sessions where they played at least one game */
  sessions: number;
  maxGamesInSession: number;
  /** doubles partners: how often, and how often they won together */
  partners: Map<string, { games: number; wins: number }>;
  /** opponents: games against them and how many of those I won */
  rivals: Map<string, { games: number; wins: number }>;
  /** best "redemption arc": lost >= 3 in a row, then won >= 2 in a row */
  comeback: { lost: number; won: number } | null;
  rating: number;
  /** how the rating was built, game by game (oldest first) */
  history: RatingStep[];
  // ---- the "other side" of the stats: losing, cold runs, wild swings
  longestLoseStreak: number;
  /** losses in a row right now (0 if the last game was a win) */
  currentLoseStreak: number;
  biggestLoss: { margin: number; scoreFor: number; scoreAgainst: number; gameId: string } | null;
  closeLosses: number;
  /** won / lost by 10+ points */
  blowoutWins: number;
  blowoutLosses: number;
  /** the fewest points they ever scored in a game they lost (null = never lost) */
  fewestPoints: number | null;
  /** games lost while scoring 5 points or fewer ("bagels") */
  bagels: number;
  maxWinsInSession: number;
  maxLossesInSession: number;
  /** sessions with 3+ games: every one won / not a single one won */
  perfectSessions: number;
  winlessSessions: number;
  /** wins when the team's win chance was under 35% / losses when it was over 65% */
  upsetWins: number;
  upsetLosses: number;
  peakRating: number;
  lowRating: number;
  /** rating points gained over the last 10 games (negative = sliding) */
  recentForm: number;
  /** rating points gained or lost over the whole run */
  pointsDiff: number;
}

/** One game's effect on someone's rating, so the number can be explained. */
export interface RatingStep {
  gameId: string;
  date: string;
  won: boolean;
  scoreFor: number;
  scoreAgainst: number;
  partner: string | null;
  opponents: string[];
  /** the chance (0..1) the system gave their team before the game */
  chance: number;
  before: number;
  after: number;
}

export interface Duo {
  a: string;
  b: string;
  games: number;
  wins: number;
  winRate: number;
}

const blank = (id: string): MemberStats => ({
  id, games: 0, wins: 0, losses: 0, winRate: 0, currentStreak: 0, longestStreak: 0, pointsFor: 0, pointsAgainst: 0,
  avgAgainst: 0, biggestWin: null, closeWins: 0, sessions: 0, maxGamesInSession: 0, partners: new Map(),
  rivals: new Map(), comeback: null, rating: RULES.ratingStart, history: [],
  longestLoseStreak: 0, currentLoseStreak: 0, biggestLoss: null, closeLosses: 0, blowoutWins: 0, blowoutLosses: 0,
  fewestPoints: null, bagels: 0, maxWinsInSession: 0, maxLossesInSession: 0, perfectSessions: 0, winlessSessions: 0,
  upsetWins: 0, upsetLosses: 0, peakRating: RULES.ratingStart, lowRating: RULES.ratingStart, recentForm: 0, pointsDiff: 0,
});

/** Chance (0..1) that a team rated `mine` beats a team rated `theirs`. Equal ratings = 50%. */
export function expectedScore(mine: number, theirs: number): number {
  return 1 / (1 + 10 ** ((theirs - mine) / 400));
}

/** Oldest first: by session date, then game number, then when it was entered. */
export function orderGames(games: Game[]): Game[] {
  return [...games].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.round - b.round || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
}

const bump = (map: Map<string, { games: number; wins: number }>, id: string, won: boolean) => {
  const e = map.get(id) ?? { games: 0, wins: 0 };
  e.games++;
  if (won) e.wins++;
  map.set(id, e);
};

export function computeStats(games: Game[]): Map<string, MemberStats> {
  const out = new Map<string, MemberStats>();
  const results = new Map<string, boolean[]>();
  const perSession = new Map<string, Map<string, number>>();
  const perSessionWins = new Map<string, Map<string, number>>();
  const get = (id: string) => {
    let m = out.get(id);
    if (!m) out.set(id, (m = blank(id)));
    return m;
  };

  for (const g of orderGames(games)) {
    if (g.scoreA === g.scoreB || g.teamA.length === 0 || g.teamB.length === 0) continue; // not a finished game
    const winner = g.scoreA > g.scoreB ? 'A' : 'B';
    const margin = Math.abs(g.scoreA - g.scoreB);

    // Elo-style rating: team strength = average rating, measured before this game
    const avg = (ids: string[]) => ids.reduce((s, i) => s + get(i).rating, 0) / ids.length;
    const expectedA = expectedScore(avg(g.teamA), avg(g.teamB));

    for (const team of ['A', 'B'] as const) {
      const mine = team === 'A' ? g.teamA : g.teamB;
      const theirs = team === 'A' ? g.teamB : g.teamA;
      const won = winner === team;
      const pf = team === 'A' ? g.scoreA : g.scoreB;
      const pa = team === 'A' ? g.scoreB : g.scoreA;
      const delta = RULES.ratingK * ((won ? 1 : 0) - (team === 'A' ? expectedA : 1 - expectedA));

      for (const id of mine) {
        const m = get(id);
        m.games++;
        if (won) m.wins++;
        else m.losses++;
        m.pointsFor += pf;
        m.pointsAgainst += pa;
        const chance = team === 'A' ? expectedA : 1 - expectedA;
        if (won) {
          if (margin > (m.biggestWin?.margin ?? 0)) m.biggestWin = { margin, scoreFor: pf, scoreAgainst: pa, gameId: g.id };
          if (margin <= RULES.closeMargin) m.closeWins++;
          if (margin >= 10) m.blowoutWins++;
          if (chance < 0.35) m.upsetWins++;
        } else {
          if (margin > (m.biggestLoss?.margin ?? 0)) m.biggestLoss = { margin, scoreFor: pf, scoreAgainst: pa, gameId: g.id };
          if (margin <= RULES.closeMargin) m.closeLosses++;
          if (margin >= 10) m.blowoutLosses++;
          if (pf <= 5) m.bagels++;
          m.fewestPoints = m.fewestPoints == null ? pf : Math.min(m.fewestPoints, pf);
          if (chance > 0.65) m.upsetLosses++;
        }
        const before = m.rating;
        m.rating += delta;
        m.peakRating = Math.max(m.peakRating, m.rating);
        m.lowRating = Math.min(m.lowRating, m.rating);
        m.history.push({
          gameId: g.id, date: g.date, won, scoreFor: pf, scoreAgainst: pa,
          partner: mine.length === 2 ? mine.find((x) => x !== id)! : null,
          opponents: theirs, chance: team === 'A' ? expectedA : 1 - expectedA, before, after: m.rating,
        });
        results.set(id, [...(results.get(id) ?? []), won]);
        if (mine.length === 2) bump(m.partners, mine.find((x) => x !== id)!, won);
        for (const o of theirs) bump(m.rivals, o, won);
        const sess = perSession.get(id) ?? new Map<string, number>();
        sess.set(g.sessionId, (sess.get(g.sessionId) ?? 0) + 1);
        perSession.set(id, sess);
        const sw = perSessionWins.get(id) ?? new Map<string, number>();
        sw.set(g.sessionId, (sw.get(g.sessionId) ?? 0) + (won ? 1 : 0));
        perSessionWins.set(id, sw);
      }
    }
  }

  for (const [id, m] of out) {
    const seq = results.get(id) ?? [];
    m.winRate = m.games ? m.wins / m.games : 0;
    m.avgAgainst = m.games ? m.pointsAgainst / m.games : 0;
    // streaks and redemption arcs from the run-lengths of wins / losses
    const runs: { win: boolean; len: number }[] = [];
    for (const w of seq) {
      const last = runs.at(-1);
      if (last && last.win === w) last.len++;
      else runs.push({ win: w, len: 1 });
    }
    m.longestStreak = Math.max(0, ...runs.filter((r) => r.win).map((r) => r.len));
    m.currentStreak = runs.at(-1)?.win ? runs.at(-1)!.len : 0;
    m.longestLoseStreak = Math.max(0, ...runs.filter((r) => !r.win).map((r) => r.len));
    m.currentLoseStreak = runs.length && !runs.at(-1)!.win ? runs.at(-1)!.len : 0;
    m.recentForm = m.history.slice(-10).reduce((sum, h) => sum + (h.after - h.before), 0);
    m.pointsDiff = m.pointsFor - m.pointsAgainst;
    for (let i = 0; i + 1 < runs.length; i++) {
      const [a, b] = [runs[i], runs[i + 1]];
      if (!a.win && a.len >= 3 && b.win && b.len >= 2 && a.len + b.len > (m.comeback ? m.comeback.lost + m.comeback.won : 0)) {
        m.comeback = { lost: a.len, won: b.len };
      }
    }
    const sess = perSession.get(id);
    m.sessions = sess?.size ?? 0;
    m.maxGamesInSession = sess ? Math.max(...sess.values()) : 0;
    const sw = perSessionWins.get(id);
    if (sess && sw) {
      for (const [sid, n] of sess) {
        const w = sw.get(sid) ?? 0;
        m.maxWinsInSession = Math.max(m.maxWinsInSession, w);
        m.maxLossesInSession = Math.max(m.maxLossesInSession, n - w);
        if (n >= 3 && w === n) m.perfectSessions++;
        if (n >= 3 && w === 0) m.winlessSessions++;
      }
    }
  }
  return out;
}

/** Every doubles pair, with how they did together. */
export function computeDuos(games: Game[]): Duo[] {
  const map = new Map<string, Duo>();
  for (const g of games) {
    if (g.scoreA === g.scoreB) continue;
    for (const team of ['A', 'B'] as const) {
      const ids = team === 'A' ? g.teamA : g.teamB;
      if (ids.length !== 2) continue;
      const [a, b] = [...ids].sort();
      const key = `${a}|${b}`;
      const d = map.get(key) ?? { a, b, games: 0, wins: 0, winRate: 0 };
      d.games++;
      if ((g.scoreA > g.scoreB ? 'A' : 'B') === team) d.wins++;
      map.set(key, d);
    }
  }
  for (const d of map.values()) d.winRate = d.wins / d.games;
  return [...map.values()];
}

// ---------- leaderboards ----------

export interface RankRow {
  /** one member, or the two members of a duo */
  ids: string[];
  /** what the ranking is about, ready to show: "14 wins", "71%" */
  text: string;
  sub?: string;
  games: number;
}
export interface Board {
  ranked: RankRow[];
  /** not ranked yet: how many more games they need */
  waiting: { id: string; games: number; need: number }[];
}
export type BoardKey = 'wins' | 'winRate' | 'active' | 'duos' | 'rating' | 'streak' | 'losses' | 'coldStreak' | 'blowouts';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** Higher first, ties broken by the next number in the list. */
const by = <T,>(...keys: ((x: T) => number)[]) => (a: T, b: T) => {
  for (const k of keys) {
    const d = k(b) - k(a);
    if (d) return d;
  }
  return 0;
};

export function buildBoards(stats: Map<string, MemberStats>, duos: Duo[], minGames: number = RULES.minGames): Record<BoardKey, Board> {
  const all = [...stats.values()].filter((m) => m.games > 0);
  const qualified = all.filter((m) => m.games >= minGames);
  const waiting = all
    .filter((m) => m.games < minGames)
    .sort(by((m) => m.games))
    .map((m) => ({ id: m.id, games: m.games, need: minGames - m.games }));
  const row = (m: MemberStats, text: string, sub?: string): RankRow => ({ ids: [m.id], text, sub, games: m.games });

  return {
    wins: {
      ranked: all.filter((m) => m.wins > 0).sort(by((m) => m.wins, (m) => m.winRate, (m) => m.games)).map((m) => row(m, plural(m.wins, 'win'), plural(m.games, 'game'))),
      waiting: [],
    },
    winRate: {
      ranked: qualified.sort(by((m) => m.winRate, (m) => m.games)).map((m) => row(m, pct(m.winRate), `${m.wins}–${m.losses}`)),
      waiting,
    },
    active: {
      ranked: [...all].sort(by((m) => m.games, (m) => m.wins)).map((m) => row(m, plural(m.games, 'game'), plural(m.sessions, 'session'))),
      waiting: [],
    },
    duos: {
      ranked: duos
        .filter((d) => d.games >= RULES.minDuoGames)
        .sort(by((d) => d.winRate, (d) => d.games))
        .map((d) => ({ ids: [d.a, d.b], text: pct(d.winRate), sub: `${d.wins}–${d.games - d.wins} together`, games: d.games })),
      waiting: [],
    },
    rating: {
      ranked: qualified.sort(by((m) => m.rating, (m) => m.games)).map((m) => row(m, String(Math.round(m.rating)), plural(m.games, 'game'))),
      waiting,
    },
    streak: {
      ranked: all
        .filter((m) => m.games >= 3 && m.longestStreak >= 2)
        .sort(by((m) => m.longestStreak, (m) => m.currentStreak))
        .map((m) => row(m, `${m.longestStreak} in a row`, m.currentStreak > 0 ? `${m.currentStreak} right now` : undefined)),
      waiting: [],
    },
    // the hall of shame 💀: most losses, the coldest runs, the heaviest beatings
    losses: {
      ranked: all.filter((m) => m.losses > 0).sort(by((m) => m.losses, (m) => 1 - m.winRate, (m) => m.games)).map((m) => row(m, plural(m.losses, 'loss', 'losses'), `${m.wins}–${m.losses}`)),
      waiting: [],
    },
    coldStreak: {
      ranked: all
        .filter((m) => m.games >= 3 && m.longestLoseStreak >= 2)
        .sort(by((m) => m.longestLoseStreak, (m) => m.currentLoseStreak))
        .map((m) => row(m, `${m.longestLoseStreak} losses in a row`, m.currentLoseStreak > 0 ? `${m.currentLoseStreak} right now 🥶` : undefined)),
      waiting: [],
    },
    blowouts: {
      ranked: all
        .filter((m) => m.biggestLoss && m.biggestLoss.margin >= 8)
        .sort(by((m) => m.biggestLoss!.margin, (m) => m.blowoutLosses))
        .map((m) => row(m, `lost ${m.biggestLoss!.scoreFor}–${m.biggestLoss!.scoreAgainst}`, `${plural(m.blowoutLosses, 'beating')} of 10+`)),
      waiting: [],
    },
  };
}

// ---------- attendance ----------

/** Longest and current run of back-to-back sessions someone came to (sessions nobody came to are skipped). */
export function attendanceStreaks(
  sessions: { id: string; date: string }[],
  attendance: { session_id: string; member_id: string }[],
  today: string
): Map<string, { longest: number; current: number }> {
  const who = new Map<string, Set<string>>();
  for (const a of attendance) who.set(a.session_id, (who.get(a.session_id) ?? new Set()).add(a.member_id));
  const played = sessions.filter((s) => s.date <= today && who.has(s.id)).sort((a, b) => a.date.localeCompare(b.date));
  const members = new Set(attendance.map((a) => a.member_id));
  const out = new Map<string, { longest: number; current: number }>();
  for (const id of members) {
    let run = 0;
    let longest = 0;
    for (const s of played) {
      run = who.get(s.id)!.has(id) ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    out.set(id, { longest, current: run });
  }
  return out;
}

// ---------- seasons ----------
// A season is a calendar month. Ratings start again at 1000 each season (the all-time rating keeps going),
// so a new month is a clean chance for everyone. Nothing is stored: a season is just that month's games.

/** Games needed to be ranked inside a season (a month is short, so lower than the all-time minimum). */
export const SEASON_MIN_GAMES = 3;

export const seasonOf = (date: string) => date.slice(0, 7);

export interface SeasonChampion {
  season: string;
  games: number;
  /** rating champion(s), the best rating among people with SEASON_MIN_GAMES+ games */
  champions: { id: string; rating: number; wins: number; losses: number }[];
  /** most wins that season */
  mostWins: { ids: string[]; wins: number } | null;
  /** the season's "participation trophy" */
  mostLosses: { ids: string[]; losses: number } | null;
}

/** One entry per past or current season that has scored games, newest first. */
export function seasonChampions(games: Game[]): SeasonChampion[] {
  const seasons = [...new Set(games.map((g) => seasonOf(g.date)))].sort().reverse();
  return seasons.map((season) => {
    const list = games.filter((g) => seasonOf(g.date) === season);
    const stats = [...computeStats(list).values()].filter((m) => m.games > 0);
    const ranked = stats.filter((m) => m.games >= SEASON_MIN_GAMES).sort(by((m) => m.rating, (m) => m.games));
    const topRating = ranked[0]?.rating;
    const wins = Math.max(0, ...stats.map((m) => m.wins));
    const losses = Math.max(0, ...stats.map((m) => m.losses));
    return {
      season,
      games: list.length,
      champions: ranked.filter((m) => m.rating === topRating).map((m) => ({ id: m.id, rating: m.rating, wins: m.wins, losses: m.losses })),
      mostWins: wins > 0 ? { ids: stats.filter((m) => m.wins === wins).map((m) => m.id), wins } : null,
      mostLosses: losses > 0 ? { ids: stats.filter((m) => m.losses === losses).map((m) => m.id), losses } : null,
    };
  });
}

/** Whole days until the season (calendar month) of `today` ends and ratings start over. */
export function daysLeftInSeason(today: string): number {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(y, m, 0).getDate() - d;
}
