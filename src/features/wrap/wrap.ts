import type { SessionSummary } from '../../shared/types';
import { COST_UNIT, formatDate, formatMoney } from '../../shared/utils/format';
import { computeDuos, computeStats, type Duo, type Game, type MemberStats } from '../stats/compute';

// The Monthly Wrap: a month of the group's badminton, as a short run of "story" slides.
// Everything is worked out from sessions, attendance and scored games, so it works even for a month
// where nobody entered scores (then the match slides are simply left out).

/** Smaller than the all-time rules: a month is short. */
export const WRAP_MIN = { games: 3, duoGames: 2 };

export type Tone = 'brand' | 'lime' | 'butter' | 'coral';

export interface Slide {
  id: string;
  tone: Tone;
  emoji: string;
  kicker: string;
  headline: string;
  /** the big number or name */
  big?: string;
  detail?: string;
  /** members to show with a big avatar */
  people?: string[];
  stats?: { label: string; value: string }[];
  facts?: { emoji: string; text: string }[];
}

export interface Wrap {
  month: string;
  label: string;
  slides: Slide[];
  /** text to paste into the group chat */
  share: string;
  sessions: number;
  matches: number;
}

export interface WrapInput {
  month: string; // YYYY-MM
  /** all sessions of the group (not only this month: used to spot new faces) */
  sessions: SessionSummary[];
  attendance: { session_id: string; member_id: string }[];
  games: Game[];
  nameOf: (id: string) => string;
  today: string;
}

export const monthLabel = (month: string) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/** Months that have at least one session with people in it (newest first), for the "previous wraps" list. */
export function wrapMonths(sessions: SessionSummary[], today: string): string[] {
  return [...new Set(sessions.filter((s) => s.date <= today && s.participant_count > 0).map((s) => s.date.slice(0, 7)))].sort().reverse();
}

/** Everyone tied on the best score, if it reaches `min`. */
function top<T>(items: T[], score: (x: T) => number, min: number): T[] {
  if (items.length === 0) return [];
  const best = Math.max(...items.map(score));
  return best >= min ? items.filter((x) => score(x) === best) : [];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const minutes = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);
const first = (name: string) => name.split(' ')[0];
const list = (ids: string[], nameOf: (id: string) => string) => {
  const n = ids.map((i) => first(nameOf(i)));
  return n.length <= 3 ? n.join(' & ') : `${n.slice(0, 2).join(', ')} +${n.length - 2}`;
};

export function buildWrap(input: WrapInput): Wrap {
  const { month, nameOf, today } = input;
  const label = monthLabel(month);
  const monthSessions = input.sessions.filter((s) => s.date.startsWith(month) && s.date <= today && s.participant_count > 0);
  const sessionIds = new Set(monthSessions.map((s) => s.id));
  const present = input.attendance.filter((a) => sessionIds.has(a.session_id));
  const attended = new Map<string, number>();
  for (const a of present) attended.set(a.member_id, (attended.get(a.member_id) ?? 0) + 1);

  const games = input.games.filter((g) => g.date.startsWith(month));
  const stats = computeStats(games);
  const duos = computeDuos(games);
  const players = [...stats.values()];
  const slides: Slide[] = [];
  const highlights: string[] = [];

  slides.push({ id: 'intro', tone: 'brand', emoji: '🏸', kicker: 'Rally Wrapped', headline: label, detail: 'Your month on court. Tap through!' });

  // --- the numbers
  const hoursMin = monthSessions.reduce((sum, s) => {
    const [a, b] = [minutes(s.start_time), minutes(s.end_time)];
    return a != null && b != null && b > a ? sum + (b - a) : sum;
  }, 0);
  const numbers: Slide['stats'] = [
    { label: monthSessions.length === 1 ? 'session' : 'sessions', value: String(monthSessions.length) },
    ...(games.length ? [{ label: games.length === 1 ? 'match' : 'matches', value: String(games.length) }] : []),
    { label: 'different players', value: String(attended.size) },
    ...(hoursMin ? [{ label: 'hours on court', value: String(Math.round((hoursMin / 60) * 10) / 10) }] : []),
  ];
  slides.push({ id: 'numbers', tone: 'lime', emoji: '📊', kicker: 'The month in numbers', headline: 'This is what you played', stats: numbers });
  highlights.push(`${monthSessions.length} session${monthSessions.length === 1 ? '' : 's'}${games.length ? `, ${games.length} matches` : ''}`);

  // --- most active (by sessions attended; games break a tie)
  const active = top([...attended.entries()], ([id, n]) => n * 1000 + (stats.get(id)?.games ?? 0), 1000);
  if (active.length) {
    const n = active[0][1];
    const ids = active.map(([id]) => id);
    slides.push({ id: 'active', tone: 'coral', emoji: '🔥', kicker: 'Most active', headline: list(ids, nameOf), big: `${n} session${n === 1 ? '' : 's'}`, detail: `out of ${monthSessions.length} this month`, people: ids.slice(0, 3) });
    highlights.push(`Most active: ${list(ids, nameOf)} (${n} sessions)`);
  }

  if (games.length > 0) {
    // --- most wins
    const wins = top(players, (m) => m.wins, 1);
    if (wins.length) {
      const ids = wins.map((m) => m.id);
      slides.push({ id: 'wins', tone: 'butter', emoji: '🏆', kicker: 'Most wins', headline: list(ids, nameOf), big: `${wins[0].wins} wins`, detail: `in ${wins[0].games} games`, people: ids.slice(0, 3) });
      highlights.push(`Most wins: ${list(ids, nameOf)} (${wins[0].wins})`);
    }
    // --- highest win rate (needs a few games, so a lucky 1-0 doesn't count)
    const rate = top(
      players.filter((m) => m.games >= WRAP_MIN.games),
      (m) => m.winRate * 1000 + m.games,
      0
    );
    if (rate.length) {
      const ids = rate.map((m) => m.id);
      slides.push({ id: 'rate', tone: 'lime', emoji: '🎯', kicker: 'Highest win rate', headline: list(ids, nameOf), big: pct(rate[0].winRate), detail: `${rate[0].wins} of ${rate[0].games} games (needs ${WRAP_MIN.games}+ to count)`, people: ids.slice(0, 3) });
      highlights.push(`Best win rate: ${list(ids, nameOf)} (${pct(rate[0].winRate)})`);
    }
    // --- longest streak
    const streak = top(players, (m) => m.longestStreak, 2);
    if (streak.length) {
      const ids = streak.map((m) => m.id);
      slides.push({ id: 'streak', tone: 'coral', emoji: '⚡', kicker: 'Longest winning streak', headline: list(ids, nameOf), big: `${streak[0].longestStreak} in a row`, detail: 'Unstoppable.', people: ids.slice(0, 3) });
      highlights.push(`Longest streak: ${list(ids, nameOf)} (${streak[0].longestStreak})`);
    }
    // --- favourite partner(s): who played together the most
    const favourite = top(duos, (d) => d.games, 2)[0];
    // --- best duo (win rate, a few games together)
    const bestDuo = top(
      duos.filter((d) => d.games >= WRAP_MIN.duoGames),
      (d) => d.winRate * 1000 + d.games,
      0
    )[0];
    if (favourite) {
      slides.push({ id: 'pair', tone: 'brand', emoji: '🤝', kicker: 'Favourite pair', headline: list([favourite.a, favourite.b], nameOf), big: `${favourite.games} games together`, detail: favourite.wins === 0 ? 'still chasing that first win together 😅' : `won ${favourite.wins} of them`, people: [favourite.a, favourite.b] });
      highlights.push(`Favourite pair: ${list([favourite.a, favourite.b], nameOf)}`);
    }
    if (bestDuo && !(favourite && bestDuo.a === favourite.a && bestDuo.b === favourite.b && bestDuo.winRate < 1)) {
      slides.push({ id: 'duo', tone: 'butter', emoji: '💪', kicker: 'Best duo', headline: list([bestDuo.a, bestDuo.b], nameOf), big: pct(bestDuo.winRate), detail: `won ${bestDuo.wins} of ${bestDuo.games} together`, people: [bestDuo.a, bestDuo.b] });
      highlights.push(`Best duo: ${list([bestDuo.a, bestDuo.b], nameOf)} (${pct(bestDuo.winRate)})`);
    }
    // --- most popular playing partner: partnered with the most different people
    const social = top(players, (m: MemberStats) => m.partners.size, 3);
    if (social.length) {
      const ids = social.map((m) => m.id);
      slides.push({ id: 'social', tone: 'lime', emoji: '🦋', kicker: 'Social butterfly', headline: list(ids, nameOf), big: `${social[0].partners.size} partners`, detail: 'played with the most different people', people: ids.slice(0, 3) });
    }
  }

  // --- fun facts
  const facts: { emoji: string; text: string }[] = [];
  const busiest = [...monthSessions].sort((a, b) => b.participant_count - a.participant_count)[0];
  if (busiest && monthSessions.length > 1) facts.push({ emoji: '🎉', text: `${formatDate(busiest.date)} was the busiest day: ${busiest.participant_count} players.` });
  const firstSeen = new Map<string, string>();
  const dateOf = new Map(input.sessions.map((s) => [s.id, s.date]));
  for (const a of input.attendance) {
    const d = dateOf.get(a.session_id);
    if (d && d <= today && (!firstSeen.has(a.member_id) || d < firstSeen.get(a.member_id)!)) firstSeen.set(a.member_id, d);
  }
  const newcomers = [...firstSeen].filter(([, d]) => d.startsWith(month)).map(([id]) => id);
  if (newcomers.length && newcomers.length < attended.size) facts.push({ emoji: '👋', text: `New faces: ${list(newcomers, nameOf)} played their first session.` });
  const avgPlayers = monthSessions.length ? Math.round(monthSessions.reduce((s, x) => s + x.participant_count, 0) / monthSessions.length) : 0;
  if (monthSessions.length > 1) facts.push({ emoji: '👥', text: `${avgPlayers} players per session on average.` });
  const venue = [...monthSessions.reduce((m, s) => (s.location ? m.set(s.location, (m.get(s.location) ?? 0) + 1) : m), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0];
  if (venue && venue[1] >= 2) facts.push({ emoji: '📍', text: `Favourite spot: ${venue[0]} (${venue[1]} sessions).` });
  const withCost = monthSessions.filter((s) => s.total_cost != null);
  if (withCost.length) {
    const total = withCost.reduce((s, x) => s + (x.total_cost ?? 0), 0);
    // costs are stored in thousands; a headline total reads better as the full amount
    facts.push({ emoji: '💸', text: `${formatMoney(total * COST_UNIT)} spent on courts.` });
    const paid = withCost.reduce((s, x) => s + x.approved_count, 0);
    const all = withCost.reduce((s, x) => s + x.participant_count, 0);
    if (all) facts.push({ emoji: '✅', text: `${paid} of ${all} payments approved (${pct(paid / all)}).` });
  }
  if (games.length) {
    const margin = (g: Game) => Math.abs(g.scoreA - g.scoreB);
    const team = (ids: string[]) => ids.map((i) => first(nameOf(i))).join(' & ');
    const win = (g: Game) => (g.scoreA > g.scoreB ? { w: g.teamA, l: g.teamB, a: g.scoreA, b: g.scoreB } : { w: g.teamB, l: g.teamA, a: g.scoreB, b: g.scoreA });
    const blowout = [...games].sort((a, b) => margin(b) - margin(a))[0];
    if (margin(blowout) >= 8) {
      const r = win(blowout);
      facts.push({ emoji: '💥', text: `Biggest blowout: ${team(r.w)} beat ${team(r.l)} ${r.a}–${r.b}.` });
    }
    const close = [...games].sort((a, b) => margin(a) - margin(b))[0];
    if (margin(close) <= 2 && games.length > 1) {
      const r = win(close);
      facts.push({ emoji: '😮', text: `Closest game: ${team(r.w)} edged ${team(r.l)} ${r.a}–${r.b}.` });
    }
    const grind = top(players, (m) => m.maxGamesInSession, 4);
    if (grind.length) facts.push({ emoji: '💪', text: `${list(grind.map((m) => m.id), nameOf)} played ${grind[0].maxGamesInSession} games in a single session.` });
  }
  if (facts.length) {
    slides.push({ id: 'facts', tone: 'brand', emoji: '✨', kicker: 'Did you know?', headline: 'Fun facts', facts: facts.slice(0, 6) });
  }

  slides.push({ id: 'outro', tone: 'brand', emoji: '🙌', kicker: label, headline: 'See you on court!', detail: 'Thanks for a great month.' });

  const share = [`🏸 Rally Wrapped: ${label}`, ...highlights.map((h) => `• ${h}`)].join('\n');
  return { month, label, slides, share, sessions: monthSessions.length, matches: games.length };
}

export type { Duo };
