import { useQuery } from '@tanstack/react-query';
import { Flame, Gauge, Percent, Swords, Trophy, Users, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { RULES, buildBoards, computeDuos, computeStats, type BoardKey } from './compute';
import { PERIODS, inPeriod, useAllTimeStats, useGames, type Period } from './hooks';
import { TITLES } from './titles';

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
];

const MEDALS = ['🥇', '🥈', '🥉'];

function Person({ m, size = 'size-8' }: { m?: Member; size?: string }) {
  return <Avatar name={m?.name ?? '?'} emoji={m?.emoji} color={m?.color} className={cn(size, 'text-[11px]')} compact />;
}

export default function LeaderboardPage() {
  const { data: group } = useCurrentGroup();
  const gid = group?.id;
  const [period, setPeriod] = useState<Period>('all');
  const [board, setBoard] = useState<BoardKey>('wins');
  const gamesQuery = useGames(gid);
  const all = useAllTimeStats(gid);
  const { data: members = [] } = useQuery({ queryKey: ['members', gid], queryFn: () => getMembers(gid!), enabled: !!gid });
  const byId = new Map<string, Member>(members.map((m) => [m.id, m]));

  // the boards follow the chosen period; titles are always all-time
  const boards = useMemo(() => {
    const games = inPeriod(gamesQuery.data ?? [], period);
    return { boards: buildBoards(computeStats(games), computeDuos(games)), count: games.length };
  }, [gamesQuery.data, period]);

  const active = BOARDS.find((b) => b.key === board)!;
  const current = boards.boards[board];
  const name = (id: string) => byId.get(id)?.name ?? 'Someone';

  return (
    <div className="space-y-6">
      <PageHeader title="Leaderboard" description="Who’s winning, who’s on fire, and who holds which title." />

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs label="Period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
            <span className="text-xs font-semibold text-muted-foreground">{boards.count} scored games</span>
          </div>

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
              <p className="text-xs text-muted-foreground">{active.blurb}</p>
              {current.ranked.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No one qualifies yet{period === 'all' ? '' : ' in this period'}. Keep playing!
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
                              <Link to={`/members/${id}`} className="hover:underline">
                                {name(id)}
                              </Link>
                            ) : (
                              name(id).split(' ')[0]
                            )}
                          </span>
                        ))}
                        {r.sub && <p className="text-xs text-muted-foreground">{r.sub}</p>}
                      </div>
                      <span className="text-base font-extrabold tabular-nums">{r.text}</span>
                    </li>
                  ))}
                </ol>
              )}
              {current.waiting.length > 0 && (
                <details className="rounded-2xl bg-muted/50 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-bold text-brand-strong">
                    Not ranked yet ({current.waiting.length}): needs {RULES.minGames} games
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {current.waiting.map((w) => (
                      <li key={w.id} className="flex items-center gap-2 text-sm">
                        <Person m={byId.get(w.id)} size="size-6" />
                        <span className="min-w-0 flex-1 truncate font-semibold">{name(w.id)}</span>
                        <span className="text-xs text-muted-foreground">
                          {w.games}/{RULES.minGames}
                        </span>
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-card">
                          <span className="block h-full rounded-full bg-brand" style={{ width: `${(w.games / RULES.minGames) * 100}%` }} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>

          <section aria-labelledby="titles-h" className="space-y-3">
            <div>
              <h2 id="titles-h" className="text-xl font-extrabold">
                Titles
              </h2>
              <p className="text-sm text-muted-foreground">Earned from how you play. They move around as games are played (all time).</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {TITLES.map((t) => {
                const holder = all.titles.holders.get(t.key);
                return (
                  <Card key={t.key} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-butter-soft text-xl" aria-hidden="true">
                        {t.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-extrabold">{t.name}</h3>
                        <p className="text-xs text-muted-foreground">{t.how}</p>
                        {holder ? (
                          <ul className="mt-2 space-y-1">
                            {holder.ids.map((id) => (
                              <li key={id} className="flex items-center gap-2 text-sm">
                                <Person m={byId.get(id)} size="size-6" />
                                <Link to={`/members/${id}`} className="font-bold hover:underline">
                                  {name(id)}
                                </Link>
                                <span className="text-xs text-muted-foreground">{holder.value(id)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs font-bold text-brand-strong">Up for grabs</p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
