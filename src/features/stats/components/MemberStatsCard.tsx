import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { cn } from '../../../shared/lib/cn';
import type { Member } from '../../../shared/types';
import { Alert } from '../../../shared/ui/alert';
import { Badge } from '../../../shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card';
import { Skeleton } from '../../../shared/ui/skeleton';
import { getMembers } from '../../members/api';
import { RULES, type BoardKey } from '../compute';
import { useAllTimeStats } from '../hooks';
import { TITLES } from '../titles';
import { monthLabel } from '../../wrap/wrap';
import { FitText } from '../../../shared/ui/fit-text';
import { TitleChip } from './TitleChip';

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-muted/60 p-3">
      <FitText className="text-2xl font-extrabold leading-tight tabular-nums">{value}</FitText>
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** One person's playing record, partners, rival and titles. Shown on their member page. */
export function MemberStatsCard({ memberId, groupId }: { memberId: string; groupId: string }) {
  const all = useAllTimeStats(groupId);
  const { data: members = [] } = useQuery({ queryKey: ['members', groupId], queryFn: () => getMembers(groupId) });
  const byId = new Map<string, Member>(members.map((m) => [m.id, m]));
  const name = (id: string) => byId.get(id)?.name ?? 'Someone';

  const s = all.stats.get(memberId);
  const earned = all.titles.byMember.get(memberId) ?? [];
  const season = all.seasonStats.get(memberId);
  const seasonRankIdx = all.seasonBoards.rating.ranked.findIndex((r) => r.ids.includes(memberId));
  const seasonRank = seasonRankIdx >= 0 ? seasonRankIdx + 1 : null;
  const crowns = all.champions.filter((c) => c.season !== all.season && c.champions.some((x) => x.id === memberId));
  const rankOf = (key: BoardKey) => {
    const i = all.boards[key].ranked.findIndex((r) => r.ids.includes(memberId));
    return i >= 0 ? i + 1 : null;
  };

  const partners = s ? [...s.partners].sort((a, b) => b[1].games - a[1].games || b[1].wins - a[1].wins) : [];
  const bestPartner = partners
    .filter(([, p]) => p.games >= RULES.minDuoGames)
    .sort((a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games || b[1].games - a[1].games)[0];
  const rival = s
    ? [...s.rivals]
        .filter(([, r]) => r.games >= RULES.minDuoGames)
        .sort((a, b) => a[1].wins / a[1].games - b[1].wins / b[1].games || b[1].games - a[1].games)[0]
    : undefined;

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <CardTitle>Stats & titles</CardTitle>
        <Link to="/leaderboard" className="text-sm font-bold text-brand-strong hover:underline">
          Leaderboard
        </Link>
      </CardHeader>
      <CardContent className="space-y-5">
        {all.error ? (
          <Alert>
            <p>{all.error.message}</p>
          </Alert>
        ) : all.isLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            {/* titles */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {earned.length > 0 ? (
                  earned.map((t) => <TitleChip key={t.key} titleKey={t.key} value={t.value} />)
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No titles yet. Play {RULES.minGames}+ scored games to start earning them.
                  </p>
                )}
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-xs font-bold text-brand-strong">
                  All titles and how to earn them ({earned.length}/{TITLES.length} unlocked)
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {TITLES.map((t) => {
                    const held = earned.find((e) => e.key === t.key);
                    const secret = t.hidden && !held;
                    return (
                      <li key={t.key} className={cn('flex items-start gap-2', !held && 'opacity-55')}>
                        <span className="w-5 text-center" aria-hidden="true">
                          {held ? t.emoji : secret ? '❓' : '🔒'}
                        </span>
                        <span className="min-w-0 break-words text-xs">
                          {secret ? (
                            <>
                              <b>??? Secret title</b>: <i>{t.hint}</i>
                            </>
                          ) : (
                            <>
                              <b>{t.name}</b>
                              {t.hard && !held && ' 🌶️'}: {held ? held.value : t.how}
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </div>

            {!s || s.games === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No scored matches yet. Add games (with scores) in a session and the stats appear here.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Tile label="Matches" value={s.games} />
                  <Tile label="Wins" value={s.wins} />
                  <Tile label="Losses" value={s.losses} />
                  <Tile
                    label="Win rate"
                    value={pct(s.winRate)}
                    hint={s.games < RULES.minGames ? `ranked from ${RULES.minGames} games` : undefined}
                  />
                </div>

                <div>
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Rough patches 🥀</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Tile
                      label="Worst losing streak"
                      value={s.longestLoseStreak}
                      hint={s.currentLoseStreak > 0 ? `${s.currentLoseStreak} right now 🥶` : undefined}
                    />
                    <Tile
                      label="Biggest loss"
                      value={s.biggestLoss ? `${s.biggestLoss.scoreFor}–${s.biggestLoss.scoreAgainst}` : '–'}
                    />
                    <Tile label="Close losses" value={s.closeLosses} hint={`${s.closeWins} close wins`} />
                    <Tile label="Beatings (10+)" value={s.blowoutLosses} hint={`${s.blowoutWins} dishes served`} />
                  </div>
                </div>

                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <dt className="text-muted-foreground">Season rating ({monthLabel(all.season).split(' ')[0]})</dt>
                    <dd className="font-bold tabular-nums">
                      {season && season.games > 0 ? (
                        <>
                          {Math.round(season.rating)}
                          {seasonRank && <span className="ml-1.5 text-xs font-bold text-brand-strong">#{seasonRank}</span>}
                          <span className="ml-1.5 text-xs font-semibold text-muted-foreground">
                            {season.games} game{season.games === 1 ? '' : 's'}
                          </span>
                        </>
                      ) : (
                        <span className="font-semibold text-muted-foreground">no games this month</span>
                      )}
                    </dd>
                  </div>
                  {crowns.length > 0 && (
                    <div className="flex flex-wrap justify-between gap-x-3">
                      <dt className="text-muted-foreground">Season champion</dt>
                      <dd className="font-bold">👑 {crowns.map((c) => monthLabel(c.season).replace(/ 20(\d\d)$/, " '$1")).join(', ')}</dd>
                    </div>
                  )}
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <dt className="text-muted-foreground">Rating range</dt>
                    <dd className="font-bold tabular-nums">
                      {Math.round(s.lowRating)} <span className="font-semibold text-muted-foreground">low</span> · {Math.round(s.peakRating)}{' '}
                      <span className="font-semibold text-muted-foreground">peak</span>
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <dt className="text-muted-foreground">Last 10 games</dt>
                    <dd className={cn('font-bold tabular-nums', s.recentForm > 0 && 'text-lime-strong', s.recentForm < 0 && 'text-coral-strong')}>
                      {s.recentForm >= 0 ? '+' : '−'}
                      {Math.abs(Math.round(s.recentForm))} rating
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <dt className="text-muted-foreground">Upsets</dt>
                    <dd className="font-bold tabular-nums">
                      {s.upsetWins} <span className="font-semibold text-muted-foreground">giant-kills</span> · {s.upsetLosses}{' '}
                      <span className="font-semibold text-muted-foreground">chokes</span>
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <dt className="text-muted-foreground">Best / worst night</dt>
                    <dd className="font-bold tabular-nums">
                      {s.maxWinsInSession} <span className="font-semibold text-muted-foreground">wins</span> · {s.maxLossesInSession}{' '}
                      <span className="font-semibold text-muted-foreground">losses</span>
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <dt className="text-muted-foreground">Point difference</dt>
                    <dd className="font-bold tabular-nums">
                      {s.pointsDiff >= 0 ? '+' : '−'}
                      {Math.abs(s.pointsDiff)}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <dt className="text-muted-foreground">Perfect / winless nights</dt>
                    <dd className="font-bold tabular-nums">
                      {s.perfectSessions} <span className="font-semibold text-muted-foreground">✨</span> · {s.winlessSessions}{' '}
                      <span className="font-semibold text-muted-foreground">💀</span>
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <dt className="text-muted-foreground">Winning streak</dt>
                    <dd className="font-bold">
                      {s.currentStreak > 0 && <Badge variant="coral" className="mr-1.5">🔥 {s.currentStreak} now</Badge>}
                      best {s.longestStreak}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <dt className="text-muted-foreground">Rating</dt>
                    <dd className="font-bold tabular-nums">
                      {s.games >= RULES.minGames ? Math.round(s.rating) : <span className="font-semibold text-muted-foreground">after {RULES.minGames} games</span>}{' '}
                      <Link to={`/how-it-works?member=${memberId}`} className="text-xs font-bold text-brand-strong hover:underline">
                        How?
                      </Link>
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <dt className="text-muted-foreground">Points per game</dt>
                    <dd className="font-bold tabular-nums">
                      {(s.pointsFor / s.games).toFixed(1)} <span className="font-semibold text-muted-foreground">for</span> ·{' '}
                      {s.avgAgainst.toFixed(1)} <span className="font-semibold text-muted-foreground">against</span>
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <dt className="text-muted-foreground">Ranks</dt>
                    <dd className="flex flex-wrap justify-end gap-1">
                      {(
                        [
                          ['wins', 'Wins'],
                          ['winRate', 'Win rate'],
                          ['active', 'Active'],
                          ['rating', 'Rating'],
                        ] as const
                      ).map(([k, label]) => {
                        const r = rankOf(k);
                        return r ? (
                          <Badge key={k} variant={r <= 3 ? 'lime' : 'neutral'}>
                            {label} #{r}
                          </Badge>
                        ) : null;
                      })}
                    </dd>
                  </div>
                </dl>

                {(partners.length > 0 || rival) && (
                  <div className="space-y-2 border-t border-border pt-4 text-sm">
                    {partners[0] && (
                      <p>
                        <span className="text-muted-foreground">Plays most with </span>
                        <b>{name(partners[0][0])}</b>{' '}
                        <span className="text-muted-foreground">
                          ({partners[0][1].games} games, won {partners[0][1].wins})
                        </span>
                        {partners[1] && (
                          <span className="text-muted-foreground">
                            , then {name(partners[1][0])} ({partners[1][1].games})
                          </span>
                        )}
                      </p>
                    )}
                    {bestPartner && (
                      <p>
                        <span className="text-muted-foreground">Best partner: </span>
                        <b>{name(bestPartner[0])}</b>{' '}
                        <span className="text-muted-foreground">
                          ({pct(bestPartner[1].wins / bestPartner[1].games)} over {bestPartner[1].games} games)
                        </span>
                      </p>
                    )}
                    {rival && (
                      <p>
                        <span className="text-muted-foreground">Toughest rival: </span>
                        <b>{name(rival[0])}</b>{' '}
                        <span className="text-muted-foreground">
                          (won {rival[1].wins} of {rival[1].games} against them)
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
