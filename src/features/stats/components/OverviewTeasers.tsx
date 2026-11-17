import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Member } from '../../../shared/types';
import { Avatar } from '../../../shared/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card';
import { todayString } from '../../../shared/utils/format';
import { getMembers } from '../../members/api';
import { getSessionSummaries } from '../../sessions/api';
import { monthLabel, wrapMonths } from '../../wrap/wrap';
import { useAllTimeStats } from '../hooks';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Two small cards on the group Overview: the top 3, and a doorway to the latest monthly wrap. */
export function OverviewTeasers({ groupId }: { groupId: string }) {
  const all = useAllTimeStats(groupId);
  const { data: members = [] } = useQuery({ queryKey: ['members', groupId], queryFn: () => getMembers(groupId) });
  const { data: sessions = [] } = useQuery({ queryKey: ['sessions', groupId], queryFn: () => getSessionSummaries(groupId) });
  const byId = new Map<string, Member>(members.map((m) => [m.id, m]));
  const top = all.boards.wins.ranked.slice(0, 3);
  const latest = wrapMonths(sessions, todayString())[0];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>🏆 Leaderboard</CardTitle>
          <Link to="/leaderboard" className="text-sm font-bold text-brand-strong hover:underline">
            See all
          </Link>
        </CardHeader>
        <CardContent>
          {top.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add scored matches in a session and the top players show up here.</p>
          ) : (
            <ol className="space-y-2">
              {top.map((r, i) => {
                const m = byId.get(r.ids[0]);
                return (
                  <li key={r.ids[0]} className="flex items-center gap-2.5 text-sm">
                    <span className="w-6 text-center text-lg">{MEDALS[i]}</span>
                    <Avatar name={m?.name ?? '?'} emoji={m?.emoji} color={m?.color} className="size-7 text-[11px]" compact />
                    <Link to={`/members/${r.ids[0]}`} className="min-w-0 flex-1 truncate font-bold hover:underline">
                      {m?.name ?? 'Someone'}
                    </Link>
                    <span className="font-extrabold tabular-nums">{r.text}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {latest && (
        <Link
          to={`/wrap?month=${latest}`}
          className="group relative flex min-h-36 flex-col justify-end gap-1 overflow-hidden rounded-card bg-linear-to-br from-brand via-brand to-lime p-5 text-ink shadow-soft transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-ink/10" />
          <Sparkles className="absolute right-5 top-5 size-6" aria-hidden="true" />
          <p className="text-xs font-extrabold uppercase tracking-widest opacity-80">Rally Wrapped</p>
          <p className="text-2xl font-extrabold leading-tight">{monthLabel(latest)}</p>
          <p className="inline-flex items-center gap-1 text-sm font-bold">
            Open your wrap <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>
      )}
    </div>
  );
}
