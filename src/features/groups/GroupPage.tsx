import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  CalendarPlus,
  Pencil,
  Search,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '../../shared/components/EmptyState';
import { StatCard } from '../../shared/components/StatCard';
import { Avatar } from '../../shared/ui/avatar';
import { Badge } from '../../shared/ui/badge';
import { Button, buttonVariants } from '../../shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { Input } from '../../shared/ui/input';
import { Skeleton } from '../../shared/ui/skeleton';
import { Table, TBody, TD, TH, THead, TR } from '../../shared/ui/table';
import { todayString } from '../../shared/utils/format';
import { getMembers } from '../members/api';
import { MemberTypeBadge } from '../members/components/MemberTypeBadge';
import { useMemberTypes } from '../members/memberType';
import { getAttendance, getSessionSummaries } from '../sessions/api';
import { SessionCard } from '../sessions/components/SessionCard';
import { getGroup } from './api';
import { GroupDialog } from './components/GroupDialog';
import { useSyncCurrentGroup } from './hooks';

/** Inside a group: info, upcoming sessions, member statistics and the member list. */
export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  useSyncCurrentGroup(id);

  const { data: group, isLoading, isError } = useQuery({
    queryKey: ['group', id],
    queryFn: () => getGroup(id!),
    enabled: !!id,
  });
  const { data: members = [] } = useQuery({
    queryKey: ['members', id],
    queryFn: () => getMembers(id!),
    enabled: !!id,
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', id],
    queryFn: () => getSessionSummaries(id!),
    enabled: !!id,
  });
  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance', id],
    queryFn: () => getAttendance(id!),
    enabled: !!id,
  });

  const types = useMemberTypes(id, members);

  const stats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of attendance) counts.set(a.member_id, (counts.get(a.member_id) ?? 0) + 1);

    const ranked = members
      .map((m) => ({ member: m, attended: counts.get(m.id) ?? 0 }))
      .sort((a, b) => b.attended - a.attended || a.member.name.localeCompare(b.member.name));

    const newcomers = [...types.values()].filter((t) => t.type === 'newcomer').length;

    const withPeople = sessions.filter((s) => s.participant_count > 0);
    const avg = withPeople.length
      ? Math.round(withPeople.reduce((n, s) => n + s.participant_count, 0) / withPeople.length)
      : null;

    return { ranked, newcomers, avg, top: ranked[0] };
  }, [members, sessions, attendance, types]);

  // sessions come newest first
  const { today, upcoming, past } = useMemo(() => {
    const t = todayString();
    return {
      today: sessions.filter((s) => s.date === t).reverse(),
      upcoming: sessions.filter((s) => s.date > t).at(-1),
      past: sessions.find((s) => s.date < t),
    };
  }, [sessions]);
  const filtered = stats.ranked.filter((r) =>
    r.member.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const topFive = stats.ranked.filter((r) => r.attended > 0).slice(0, 5);

  if (isLoading) return <Skeleton className="h-56" />;
  if (isError || !group) {
    return (
      <Card>
        <EmptyState
          emoji="🤷"
          title="Group not found"
          action={<Link to="/" className={buttonVariants({ variant: 'outline' })}>Back to dashboard</Link>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden">
        <div className="h-20 bg-linear-to-r from-brand/70 via-butter/60 to-lime/60" aria-hidden="true" />
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 pb-5">
          <div className="flex min-w-0 items-start gap-4">
            <span className="-mt-10 flex size-20 shrink-0 items-center justify-center rounded-3xl border-4 border-card bg-lime-soft text-4xl shadow-soft">
              {group.emoji}
            </span>
            <div className="min-w-0 pt-3">
              <h1 className="truncate text-2xl font-extrabold tracking-tight">{group.name}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {members.length} members · {sessions.length} sessions
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
            <Link to="/members" className={buttonVariants()}>
              <UserPlus /> Add members
            </Link>
          </div>
        </div>
      </Card>

      <section aria-label="Member statistics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total members" value={members.length} icon={Users} tone="brand" />
        <StatCard
          label="Avg. attendance"
          value={stats.avg ?? '—'}
          hint="per session"
          icon={CalendarDays}
          tone="lime"
        />
        <StatCard label="Newcomers" value={stats.newcomers} hint="recently joined" icon={UserPlus} tone="butter" />
        <StatCard
          label="Most active"
          value={stats.top && stats.top.attended > 0 ? stats.top.member.name.split(' ')[0] : '—'}
          hint={stats.top && stats.top.attended > 0 ? `${stats.top.attended} sessions` : undefined}
          icon={Trophy}
          tone="coral"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-3">
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
            <Link to="/sessions" className="text-sm font-bold text-brand-strong hover:underline">
              All sessions
            </Link>
          </CardHeader>
          <CardContent className="space-y-5">
            {today.length > 0 && (
              <section aria-labelledby="today-h" className="space-y-2">
                <h4 id="today-h" className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-coral-strong">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-coral opacity-75 motion-reduce:animate-none" />
                    <span className="relative inline-flex size-2 rounded-full bg-coral" />
                  </span>
                  Today
                </h4>
                {today.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </section>
            )}

            <section aria-labelledby="next-h" className="space-y-2">
              <h4 id="next-h" className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Next up
              </h4>
              {upcoming ? (
                <SessionCard session={upcoming} />
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                  No upcoming sessions
                  <Link to="/sessions/new" className={buttonVariants({ size: 'sm' })}>
                    <CalendarPlus /> New session
                  </Link>
                </div>
              )}
            </section>

            <section aria-labelledby="last-h" className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 id="last-h" className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Last played
                </h4>
                {past && (
                  <Link to="/sessions?tab=past" className="text-xs font-bold text-brand-strong hover:underline">
                    All past
                  </Link>
                )}
              </div>
              {past ? (
                <SessionCard session={past} />
              ) : (
                <p className="rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                  No past sessions yet
                </p>
              )}
            </section>
          </CardContent>
        </Card>

        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>Top attendance</CardTitle>
            <Badge variant="lime">All time</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {topFive.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Attendance shows up here once sessions have participants.
              </p>
            )}
            {topFive.map((r, i) => (
              <div key={r.member.id} className="flex items-center gap-3">
                <span className="w-4 text-sm font-extrabold text-muted-foreground">{i + 1}</span>
                <Avatar name={r.member.name} className="size-8" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate font-bold">{r.member.name}</span>
                    <span className="font-semibold text-muted-foreground">{r.attended}</span>
                  </div>
                  <div
                    role="img"
                    aria-label={`${r.attended} sessions`}
                    className="mt-1 h-2 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500"
                      style={{ width: `${(r.attended / topFive[0].attended) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-wrap">
          <CardTitle>Members</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search members"
              placeholder="Search members…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="px-1 pb-2 sm:px-3">
          {members.length === 0 ? (
            <EmptyState
              emoji="👥"
              title="No members yet"
              description="Add people one by one or paste a whole list."
              action={
                <Link to="/members" className={buttonVariants({ size: 'sm' })}>
                  <UserPlus /> Add members
                </Link>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Name</TH>
                  <TH className="text-right">Sessions</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map(({ member, attended }) => (
                  <TR key={member.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={member.name} />
                        <span className="font-bold">{member.name}</span>
                        <MemberTypeBadge result={types.get(member.id)} />
                      </div>
                    </TD>
                    <TD className="text-right font-semibold">{attended}</TD>
                  </TR>
                ))}
                {filtered.length === 0 && (
                  <TR>
                    <TD colSpan={2} className="py-8 text-center text-muted-foreground">
                      No members match “{query}” 🔍
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editing && <GroupDialog open onClose={() => setEditing(false)} group={group} />}
    </div>
  );
}
