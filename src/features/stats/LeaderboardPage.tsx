import { useQuery } from '@tanstack/react-query';
import { Flame, Gauge, HelpCircle, Percent, Skull, Snowflake, Swords, Trophy, Users, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import { cn } from '../../shared/lib/cn';
import type { Member } from '../../shared/types';
import { Alert } from '../../shared/ui/alert';
import { Avatar } from '../../shared/ui/avatar';
import { buttonVariants } from '../../shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { Skeleton } from '../../shared/ui/skeleton';
import { Tabs } from '../../shared/ui/tabs';
import { useCurrentGroup } from '../groups/hooks';
import { getMembers } from '../members/api';
import { RULES, SEASON_MIN_GAMES, buildBoards, computeDuos, computeStats, daysLeftInSeason, seasonOf, type BoardKey } from './compute';
import { inPeriod, useAllTimeStats, useGames, type Period } from './hooks';
import { TitleEmojis } from './components/TitleChip';
import { TITLES } from './titles';
import { todayString } from '../../shared/utils/format';
import { monthLabel } from '../wrap/wrap';
import { MemberPicker } from '../members/components/MemberPicker';
import { FitText } from '../../shared/ui/fit-text';

const BOARDS: { key: BoardKey; label: string; icon: LucideIcon; blurb: string }[] = [
  { key: 'wins', label: 'Most wins', icon: Trophy, blurb: 'Every win counts. Ties are broken by win rate, then by games played.' },
  { key: 'winRate', label: 'Win rate', icon: Percent, blurb: `Needs ${RULES.minGames}+ games, so a lucky 2–0 start can’t top the list.` },
  { key: 'active', label: 'Most active', icon: Swords, blurb: 'Most games played.' },
  { key: 'duos', label: 'Best duo', icon: Users, blurb: `Pairs with ${RULES.minDuoGames}+ games together, ranked by win rate.` },
  {
    key: 'rating',
    label: 'Rating',
    icon: Gauge,
    blurb: `Like chess ratings: everyone starts at ${RULES.ratingStart}, and beating strong opponents earns more than beating weak ones. Needs ${RULES.minGames}+ games.`,
  },
  { key: 'streak', label: 'Streaks', icon: Flame, blurb: 'Longest run of wins in a row (3+ games played).' },
  { key: 'losses', label: 'Most losses', icon: Skull, blurb: 'The hall of shame: every loss counts. Thank you for your service.' },
  { key: 'coldStreak', label: 'Cold streaks', icon: Snowflake, blurb: 'Longest run of losses in a row (3+ games played). Bring a jacket.' },
  { key: 'blowouts', label: 'Beatings', icon: Skull, blurb: 'The heaviest single-game defeats (lost by 8+ points).' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

function Person({ m, size = 'size-8' }: { m?: Member; size?: string }) {
  return <Avatar name={m?.name ?? '?'} emoji={m?.emoji} color={m?.color} className={cn(size, 'text-[11px]')} compact />;
}

export default function LeaderboardPage() {
  const { data: group } = useCurrentGroup();
  const gid = group?.id;
  const today = todayString();
  const thisSeason = seasonOf(today);
  // default view = the current season (ratings start again every month)
  const [period, setPeriod] = useState<Period>(thisSeason);
  const [board, setBoard] = useState<BoardKey>('wins');
  // "Rankings" or "Titles" (a link can open straight on the titles: /leaderboard?view=titles)
  const [params] = useSearchParams();
  const [view, setView] = useState<'rankings' | 'titles'>(params.get('view') === 'titles' ? 'titles' : 'rankings');
  const gamesQuery = useGames(gid);
  const all = useAllTimeStats(gid);
  const { data: members = [] } = useQuery({ queryKey: ['members', gid], queryFn: () => getMembers(gid!), enabled: !!gid });
  const byId = new Map<string, Member>(members.map((m) => [m.id, m]));

  // the boards follow the chosen period; titles are always all-time
  const boards = useMemo(() => {
    const games = inPeriod(gamesQuery.data ?? [], period);
    const min = period === 'all' ? RULES.minGames : SEASON_MIN_GAMES;
    return { boards: buildBoards(computeStats(games), computeDuos(games), min), count: games.length, min };
  }, [gamesQuery.data, period]);
  const seasons = useMemo(
    () => [...new Set([thisSeason, ...(gamesQuery.data ?? []).map((g) => seasonOf(g.date))])].sort().reverse(),
    [gamesQuery.data, thisSeason]
  );

  const active = BOARDS.find((b) => b.key === board)!;
  const current = boards.boards[board];
  const name = (id: string) => byId.get(id)?.name ?? 'Someone';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leaderboard"
        description="Who’s winning, who’s on fire, and who holds which title."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MemberPicker members={members} />
            <Link to="/how-it-works" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <HelpCircle /> How it works
            </Link>
          </div>
        }
      />

      {gamesQuery.error ? (
        <Alert>
          <p>{(gamesQuery.error as Error).message}</p>
        </Alert>
      ) : gamesQuery.isLoading || !gid ? (
        <Skeleton className="h-64" />
      ) : (gamesQuery.data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            emoji="🏸"
            title="No scored matches yet"
            description="Add games with scores inside a session (Matches card) and the leaderboard, titles and monthly wrap fill themselves in."
            action={
              <Link to="/sessions" className={buttonVariants({ size: 'sm' })}>
                Go to sessions
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <Tabs<'rankings' | 'titles'>
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'rankings', label: 'Rankings' },
              { value: 'titles', label: '🏅 Titles' },
            ]}
          />

          {view === 'rankings' && (
            <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-bold">
              Season
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-9 min-w-0 rounded-control border border-border bg-card px-2.5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-ring"
              >
                {seasons.map((s) => (
                  <option key={s} value={s}>
                    {monthLabel(s)}
                    {s === thisSeason ? ' (this season)' : ''}
                  </option>
                ))}
                <option value="all">All time</option>
              </select>
            </label>
            <span className="text-xs font-semibold text-muted-foreground">{boards.count} scored games</span>
          </div>

          <Card className="space-y-1 bg-brand-soft p-4">
            {period === 'all' ? (
              <p className="text-sm font-bold text-ink">♾️ All time: ratings run across every month, nothing resets.</p>
            ) : (
              <>
                <p className="text-sm font-extrabold text-ink">
                  {period === thisSeason ? '🌱 Season in progress' : '🏁 Season finished'}: {monthLabel(period)}
                </p>
                <p className="text-xs font-semibold text-ink/80">
                  {period === thisSeason
                    ? `Everyone started the month at ${RULES.ratingStart}. ${daysLeftInSeason(today) === 0 ? 'Last day!' : `${daysLeftInSeason(today)} day${daysLeftInSeason(today) === 1 ? '' : 's'} left`} before ratings start again.`
                    : 'Final standings, frozen. A fresh season starts every month with everyone back at 1000.'}{' '}
                  Ranked from {boards.min}+ games.
                </p>
              </>
            )}
          </Card>

          <div role="tablist" aria-label="Leaderboard" className="flex flex-wrap gap-2">
            {BOARDS.map((b) => {
              const Icon = b.icon;
              return (
                <button
                  key={b.key}
                  type="button"
                  role="tab"
                  aria-selected={board === b.key}
                  onClick={() => setBoard(b.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    board === b.key ? 'bg-brand text-ink' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="size-3.5" /> {b.label}
                </button>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{active.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {active.blurb}{' '}
                <Link to="/how-it-works" className="font-bold text-brand-strong hover:underline">
                  How is this worked out?
                </Link>
              </p>
              {current.ranked.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No one qualifies yet{period === 'all' ? '' : ' this season'}. Keep playing!
                </p>
              ) : (
                <ol className="divide-y divide-border">
                  {current.ranked.slice(0, 15).map((r, i) => (
                    <li key={r.ids.join('|')} className="flex items-center gap-3 py-2.5">
                      <span className="w-7 text-center text-lg font-extrabold">{MEDALS[i] ?? <span className="text-sm text-muted-foreground">{i + 1}</span>}</span>
                      <div className="flex shrink-0 -space-x-2">
                        {r.ids.map((id) => (
                          <Person key={id} m={byId.get(id)} />
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        {r.ids.map((id, k) => (
                          <span key={id} className="font-bold">
                            {k > 0 && ' & '}
                            {r.ids.length === 1 ? (
                              <>
                                <Link to={`/members/${id}`} className="hover:underline">
                                  {name(id)}
                                </Link>{' '}
                                <TitleEmojis held={all.titles.byMember.get(id)} />
                              </>
                            ) : (
                              name(id).split(' ')[0]
                            )}
                          </span>
                        ))}
                        {r.sub && <p className="text-xs text-muted-foreground">{r.sub}</p>}
                      </div>
                      <span className="max-w-[40%] shrink-0 text-right">
                        <FitText className="text-base font-extrabold tabular-nums" minPx={10}>
                          {r.text}
                        </FitText>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {current.waiting.length > 0 && (
                <details className="rounded-2xl bg-muted/50 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-bold text-brand-strong">
                    Not ranked yet ({current.waiting.length}): needs {boards.min} games
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {current.waiting.map((w) => (
                      <li key={w.id} className="flex items-center gap-2 text-sm">
                        <Person m={byId.get(w.id)} size="size-6" />
                        <span className="min-w-0 flex-1 truncate font-semibold">{name(w.id)}</span>
                        <span className="text-xs text-muted-foreground">
                          {w.games}/{boards.min}
                        </span>
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-card">
                          <span className="block h-full rounded-full bg-brand" style={{ width: `${(w.games / boards.min) * 100}%` }} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>👑 Hall of champions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Every season (month) crowns the top rating, the most wins and the most losses. Ratings start over each month.
              </p>
              {all.champions.filter((c) => c.season !== thisSeason).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No finished seasons yet. The first champion is crowned when this month ends.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {all.champions
                    .filter((c) => c.season !== thisSeason)
                    .map((c) => (
                      <li key={c.season} className="space-y-0.5 py-2.5 text-sm">
                        <p className="font-extrabold">{monthLabel(c.season)}</p>
                        <p className="break-words">
                          👑{' '}
                          {c.champions.length ? (
                            c.champions.map((x, k) => (
                              <span key={x.id}>
                                {k > 0 && ' & '}
                                <Link to={`/members/${x.id}`} className="font-bold hover:underline">
                                  {name(x.id)}
                                </Link>
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground">nobody ranked</span>
                          )}
                          {c.champions[0] && <span className="text-muted-foreground"> · rated {Math.round(c.champions[0].rating)}</span>}
                        </p>
                        {c.mostWins && (
                          <p className="break-words text-xs text-muted-foreground">
                            🏆 Most wins: {c.mostWins.ids.map(name).join(' & ')} ({c.mostWins.wins})
                          </p>
                        )}
                        {c.mostLosses && (
                          <p className="break-words text-xs text-muted-foreground">
                            🥉 Participation trophy: {c.mostLosses.ids.map(name).join(' & ')} ({c.mostLosses.losses} losses)
                          </p>
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
            </>
          )}

          {view === 'titles' && (
          <section aria-labelledby="titles-h" className="space-y-3">
            <div>
              <h2 id="titles-h" className="text-xl font-extrabold">
                Titles
              </h2>
              <p className="text-sm text-muted-foreground">
                Earned from how you play (all time). “Best at” titles move around as games are played, and stat titles need {RULES.minGames}+ scored games.{' '}
                <Link to="/how-it-works" className="font-bold text-brand-strong hover:underline">
                  How it works
                </Link>
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {TITLES.map((t) => {
                const holder = all.titles.holders.get(t.key);
                const secret = t.hidden && !holder;
                return (
                  <Card key={t.key} className={cn('p-4', secret && 'border-dashed bg-muted/40')}>
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-butter-soft text-xl" aria-hidden="true">
                        {secret ? '❓' : t.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words font-extrabold">
                          {secret ? '??? Secret title' : t.name}
                          {t.hard && <span className="ml-1.5 align-middle text-[10px] font-extrabold uppercase text-coral-strong">🌶️ hard</span>}
                          {t.hidden && holder && <span className="ml-1.5 align-middle text-[10px] font-extrabold uppercase text-brand-strong">🕵️ unlocked</span>}
                        </h3>
                        <p className="text-xs text-muted-foreground">{secret ? t.hint : t.how}</p>
                        {holder ? (
                          <ul className="mt-2 space-y-1">
                            {holder.ids.map((id) => (
                              <li key={id} className="flex flex-wrap items-center gap-x-2 text-sm">
                                <Person m={byId.get(id)} size="size-6" />
                                <Link to={`/members/${id}`} className="font-bold hover:underline">
                                  {name(id)}
                                </Link>
                                <span className="text-xs text-muted-foreground">{holder.value(id)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs font-bold text-brand-strong">{secret ? 'Nobody has found it yet…' : 'Up for grabs'}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
          )}
        </>
      )}
    </div>
  );
}
