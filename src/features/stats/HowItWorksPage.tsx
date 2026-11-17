import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../shared/components/PageHeader';
import { cn } from '../../shared/lib/cn';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { Skeleton } from '../../shared/ui/skeleton';
import { formatDate } from '../../shared/utils/format';
import { useCurrentGroup } from '../groups/hooks';
import { getMembers } from '../members/api';
import { useMe } from '../members/useMe';
import { RULES, SEASON_MIN_GAMES, expectedScore } from './compute';
import { useAllTimeStats } from './hooks';
import { TITLES } from './titles';

const sign = (n: number) => (n >= 0 ? '+' : '−') + Math.abs(Math.round(n));

/** A plain-words page: how the rating works, why there is a minimum, and how each title is earned. */
export default function HowItWorksPage() {
  const { data: group } = useCurrentGroup();
  const gid = group?.id;
  const [params, setParams] = useSearchParams();
  const me = useMe(gid);
  const all = useAllTimeStats(gid);
  const { data: members = [] } = useQuery({ queryKey: ['members', gid], queryFn: () => getMembers(gid!), enabled: !!gid });
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? 'Someone';
  const first = (id: string) => name(id).split(' ')[0];

  // the example numbers come from the same formula the app really uses
  const K = RULES.ratingK;
  const even = K * (1 - expectedScore(1000, 1000));
  const upset = K * (1 - expectedScore(960, 1040)); // the weaker team wins
  const expected = K * (1 - expectedScore(1040, 960)); // the stronger team wins

  const players = useMemo(
    () => [...all.stats.values()].filter((s) => s.games > 0).sort((a, b) => b.rating - a.rating),
    [all.stats]
  );
  const asked = params.get('member');
  const picked = players.find((p) => p.id === asked) ?? players.find((p) => p.id === me.memberId) ?? players[0];

  return (
    <div className="space-y-6">
      <Link to="/leaderboard" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-strong hover:underline">
        <ArrowLeft className="size-4" /> Leaderboard
      </Link>
      <PageHeader title="How the stats work" description="The short, simple version." />

      <Card>
        <CardHeader>
          <CardTitle>⭐ Rating</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>
            Rating is a score for <b>how good you are</b>, using the same idea as chess ratings. It is fairer than just counting wins,
            because it also looks at <b>who you played against</b>.
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Everyone starts at <b>{RULES.ratingStart}</b>.
            </li>
            <li>
              <b>Win a game and you gain points. Lose and you lose points.</b> The most one game can move you is {K}.
            </li>
            <li>
              In doubles, a team’s strength is the <b>average</b> of its two players’ ratings.
            </li>
            <li>
              Before the game, Rally guesses who should win from those two strengths. <b>The more surprising the result, the more points move.</b>
            </li>
          </ol>

          <div className="space-y-2 rounded-2xl bg-muted/60 p-4">
            <p className="font-extrabold">Three examples</p>
            <p>
              🤝 <b>Two equal teams</b> (both rated 1000): it is a coin flip, so the winners get <b>{sign(even)}</b> and the losers {sign(-even)}.
            </p>
            <p>
              😮 <b>An upset</b>: a team rated 960 beats a team rated 1040. Nobody expected that, so the winners get <b>{sign(upset)}</b> and
              the losers {sign(-upset)}.
            </p>
            <p>
              😴 <b>The favourite wins</b>: the 1040 team beats the 960 team. That was expected, so they only get <b>{sign(expected)}</b>.
            </p>
          </div>

          <p>
            So a few lucky wins against weak players won’t make a high rating, and one loss to a much stronger team won’t hurt much. The
            score <b>doesn’t matter</b>, only who won (a 21–19 win counts the same as 21–5). Ties are ignored.
          </p>
          <p>
            You show up on the Rating board after <b>{RULES.minGames} games</b>. Before that your rating is still worked out, it just
            isn’t ranked yet.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🌱 Seasons: a fresh start every month</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed">
          <p>
            Every <b>calendar month is a season</b>. On the 1st, everyone’s <b>season rating</b> starts again at {RULES.ratingStart}, so a bad
            month never follows you around and anyone can win the next one.
          </p>
          <p>
            When a season ends, its <b>champion</b> (best rating, with at least {SEASON_MIN_GAMES} games), the most wins and the most losses go into
            the <Link to="/leaderboard" className="font-bold text-brand-strong hover:underline">Hall of champions</Link>. The{' '}
            <b>all-time rating</b> below never resets: pick “All time” on the Leaderboard to see it. Nothing is deleted, seasons are just each
            month’s games.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🔎 See how a rating was built</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {all.isLoading ? (
            <Skeleton className="h-32" />
          ) : players.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scored games yet, so there are no ratings to explain.</p>
          ) : picked ? (
            <>
              <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
                Whose rating?
                <select
                  value={picked.id}
                  onChange={(e) => setParams({ member: e.target.value }, { replace: true })}
                  className="h-9 rounded-control border border-border bg-card px-2.5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {name(p.id)} ({Math.round(p.rating)})
                    </option>
                  ))}
                </select>
              </label>

              <p className="text-sm">
                <b>{first(picked.id)}</b> started at {RULES.ratingStart} and is now at <b>{Math.round(picked.rating)}</b> after {picked.games} game
                {picked.games === 1 ? '' : 's'}. Here is every game, newest first:
              </p>

              <ol className="divide-y divide-border">
                {[...picked.history].reverse().map((h, i, list) => (
                  <li key={h.gameId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                    <span
                      className={cn(
                        'inline-flex w-14 justify-center rounded-full px-2 py-0.5 text-xs font-extrabold',
                        h.won ? 'bg-lime-soft text-lime-strong' : 'bg-coral-soft text-coral-strong'
                      )}
                    >
                      {h.won ? 'Won' : 'Lost'} {h.scoreFor}–{h.scoreAgainst}
                    </span>
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="block font-semibold">
                        {h.partner ? `with ${first(h.partner)} ` : 'singles '}vs {h.opponents.map(first).join(' & ')}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(h.date)} · team’s win chance was {Math.round(h.chance * 100)}%
                      </span>
                    </span>
                    <span className={cn('w-10 text-right font-extrabold tabular-nums', h.won ? 'text-lime-strong' : 'text-coral-strong')}>
                      {sign(h.after - h.before)}
                    </span>
                    <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
                      → {Math.round(h.after)}
                      {i === list.length - 1 && <span className="block">from {RULES.ratingStart}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📏 Why a minimum number of games?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed">
          <p>
            Winning 2 out of 2 games is a 100% win rate, but it doesn’t mean much yet. So the <b>win rate</b> and <b>rating</b> boards wait
            until you’ve played <b>{RULES.minGames} games</b>, and the <b>best duo</b> board waits for <b>{RULES.minDuoGames} games together</b>.
            Everyone still sees their own numbers; the ranking just waits.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🏅 Titles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Titles come from your scored games. “Best at” titles belong to whoever is ahead right now (ties share it), so they can move
            around. Stat titles need {RULES.minGames}+ games first.{' '}
            <Link to="/leaderboard?view=titles" className="font-bold text-brand-strong hover:underline">
              See who has which
            </Link>
          </p>
          <ul className="space-y-2">
            {TITLES.filter((t) => !t.hidden || all.titles.holders.has(t.key)).map((t) => (
              <li key={t.key} className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-butter-soft text-base" aria-hidden="true">
                  {t.emoji}
                </span>
                <span>
                  <b>{t.name}</b>
                  {t.hard && <span className="ml-1.5 text-[10px] font-extrabold uppercase text-coral-strong">🌶️ hard</span>}
                  {t.hidden && <span className="ml-1.5 text-[10px] font-extrabold uppercase text-brand-strong">🕵️ was secret</span>}
                  <span className="block text-xs text-muted-foreground">{t.how}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="rounded-2xl bg-muted/60 p-3 text-xs font-semibold">
            🕵️ There are also <b>{TITLES.filter((t) => t.hidden && !all.titles.holders.has(t.key)).length} secret titles</b> nobody has unlocked yet.
            No spoilers here: they show up on the Titles tab once someone earns them (or as a cryptic hint on a member’s page).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
