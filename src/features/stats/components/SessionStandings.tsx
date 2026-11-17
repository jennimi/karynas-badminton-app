import { useQuery } from '@tanstack/react-query';
import { Crown } from 'lucide-react';
import { cn } from '../../../shared/lib/cn';
import type { Member } from '../../../shared/types';
import { Avatar } from '../../../shared/ui/avatar';
import { Badge } from '../../../shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card';
import { getMembers } from '../../members/api';
import { getMatches } from '../../matchmaking/api';
import { matchToGame } from '../api';
import { computeDuos, computeStats } from '../compute';
import { useMemo } from 'react';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Who is winning tonight: wins and losses of everyone who played in this session, and its best pair.
 * No minimum games here: a session is short, and it resets every time. Uses the same matches the
 * Matches card shows, so it updates the moment a score is saved.
 */
export function SessionStandings({ sessionId, sessionDate, groupId }: { sessionId: string; sessionDate: string; groupId: string }) {
  const { data: matches = [] } = useQuery({ queryKey: ['matches', sessionId], queryFn: () => getMatches(sessionId), retry: false });
  const { data: members = [] } = useQuery({ queryKey: ['members', groupId], queryFn: () => getMembers(groupId) });
  const byId = new Map<string, Member>(members.map((m) => [m.id, m]));

  const { rows, duo, unscored } = useMemo(() => {
    const games = matches.map((m) => matchToGame(m, sessionDate)).filter((g): g is NonNullable<typeof g> => !!g);
    const stats = [...computeStats(games).values()].sort(
      (a, b) => b.wins - a.wins || b.winRate - a.winRate || b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst)
    );
    const duo = computeDuos(games)
      .filter((d) => d.games >= 2)
      .sort((a, b) => b.winRate - a.winRate || b.games - a.games)[0];
    return { rows: stats, duo, unscored: matches.length - games.length };
  }, [matches, sessionDate]);

  if (rows.length === 0) return null; // nothing scored yet: the Matches card already says so

  const name = (id: string) => byId.get(id)?.name ?? 'Someone';
  const top = rows[0];
  const leaders = rows.filter((r) => r.wins === top.wins && r.winRate === top.winRate).map((r) => r.id);

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <CardTitle>Standings</CardTitle>
        <Badge variant="lime">
          <Crown className="size-3.5" /> {leaders.map((id) => name(id).split(' ')[0]).join(' & ')} leads
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y divide-border">
          {rows.map((r, i) => {
            const m = byId.get(r.id);
            const diff = r.pointsFor - r.pointsAgainst;
            return (
              <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-4 text-center text-xs font-extrabold text-muted-foreground">{i + 1}</span>
                <Avatar name={name(r.id)} emoji={m?.emoji} color={m?.color} className="size-7 text-[11px]" compact />
                <span className="min-w-0 flex-1 truncate font-bold">{name(r.id)}</span>
                <span className="font-extrabold tabular-nums">
                  {r.wins}–{r.losses}
                </span>
                <span className="hidden w-12 text-right text-xs font-semibold text-muted-foreground sm:inline">{pct(r.winRate)}</span>
                <span
                  className={cn('w-10 text-right text-xs font-bold tabular-nums', diff > 0 ? 'text-lime-strong' : diff < 0 ? 'text-coral-strong' : 'text-muted-foreground')}
                  title="Points scored minus points conceded"
                >
                  {diff > 0 ? '+' : ''}
                  {diff}
                </span>
              </li>
            );
          })}
        </ul>
        {duo && (
          <p className="rounded-2xl bg-butter-soft p-3 text-sm font-semibold text-butter-strong">
            🤝 Best pair tonight: {name(duo.a)} & {name(duo.b)}, won {duo.wins} of {duo.games} together
          </p>
        )}
        {unscored > 0 && (
          <p className="text-xs text-muted-foreground">
            {unscored} game{unscored === 1 ? '' : 's'} without a final score {unscored === 1 ? "isn't" : "aren't"} counted.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
