import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CalendarPlus, Flame, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import { StatCard } from '../../shared/components/StatCard';
import { Badge } from '../../shared/ui/badge';
import { buttonVariants } from '../../shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { Skeleton } from '../../shared/ui/skeleton';
import { relativeDay, todayString } from '../../shared/utils/format';
import { getGroups } from '../groups/api';
import { GroupDialog } from '../groups/components/GroupDialog';
import { getUpcomingSessions } from '../sessions/api';
import { SessionCard } from '../sessions/components/SessionCard';

/** Landing page: your groups and what's coming up. */
export default function DashboardPage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
  });
  const { data: upcoming = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['upcomingSessions'],
    queryFn: () => getUpcomingSessions(todayString(), 5),
  });

  const totalMembers = groups.reduce((n, g) => n + g.member_count, 0);
  const totalSessions = groups.reduce((n, g) => n + g.session_count, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Let’s play! 🏸"
        description="Here’s what’s happening in your badminton community."
        actions={
          <Link to="/sessions/new" className={buttonVariants()}>
            <CalendarPlus /> New session
          </Link>
        }
      />

      <section aria-label="Overview" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Groups" value={groups.length} icon={Users} tone="brand" />
        <StatCard label="Members" value={totalMembers} icon={Users} tone="lime" />
        <StatCard label="Sessions held & planned" value={totalSessions} icon={Flame} tone="coral" />
        <StatCard
          label="Next game"
          value={upcoming[0] ? relativeDay(upcoming[0].date) : '—'}
          hint={upcoming[0]?.title ?? undefined}
          icon={CalendarDays}
          tone="butter"
        />
      </section>

      <section aria-labelledby="groups-heading" className="space-y-4">
        <h2 id="groups-heading" className="text-xl font-extrabold">Your groups</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {loadingGroups && <Skeleton className="h-40" />}
          {groups.map((g) => (
            <Link
              key={g.id}
              to={`/groups/${g.id}`}
              className="group rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Card className="h-full p-5 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-brand">
                <div className="flex items-center gap-4">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-lime-soft text-3xl">
                    {g.emoji}
                  </span>
                  <h3 className="min-w-0 truncate text-lg font-extrabold">{g.name}</h3>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="brand">{g.member_count} members</Badge>
                  <Badge variant="butter">{g.session_count} sessions</Badge>
                </div>
              </Card>
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-brand hover:bg-brand-soft/40 hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Plus className="size-5" />
            </span>
            <span className="font-bold">Create a new group</span>
          </button>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming sessions</CardTitle>
          <Link to="/sessions" className="text-sm font-bold text-brand-strong hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingSessions && <Skeleton className="h-20" />}
          {!loadingSessions && upcoming.length === 0 && (
            <EmptyState
              emoji="🗓️"
              title="Nothing planned yet"
              description="Create a session and pick who’s coming."
              action={
                <Link to="/sessions/new" className={buttonVariants({ size: 'sm' })}>
                  <CalendarPlus /> Create a session
                </Link>
              }
            />
          )}
          {upcoming.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </CardContent>
      </Card>

      {/* remount on open so the form starts empty each time */}
      {creating && (
        <GroupDialog
          open
          onClose={() => setCreating(false)}
          onSaved={(g) => navigate(`/groups/${g.id}`)}
        />
      )}
    </div>
  );
}
