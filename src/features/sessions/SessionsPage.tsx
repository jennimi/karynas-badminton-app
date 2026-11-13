import { useQuery } from '@tanstack/react-query';
import { CalendarPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import { SortControl, type SortDir } from '../../shared/components/SortControl';
import { buttonVariants } from '../../shared/ui/button';
import { Skeleton } from '../../shared/ui/skeleton';
import { Tabs } from '../../shared/ui/tabs';
import { isUpcoming } from '../../shared/utils/format';
import { useCurrentGroup } from '../groups/hooks';
import { getSessionSummaries } from './api';
import { SessionCard } from './components/SessionCard';
import type { SessionSummary } from '../../shared/types';

type SessionSort = 'date' | 'location' | 'players' | 'unpaid';

/** Natural direction for each sort: soonest first when upcoming, newest first when past. */
const defaultDir = (key: SessionSort, tab: 'upcoming' | 'past'): SortDir =>
  key === 'date' ? (tab === 'upcoming' ? 'asc' : 'desc') : key === 'location' ? 'asc' : 'desc';

const unpaidOf = (s: SessionSummary) => s.participant_count - s.approved_count;

function sortSessions(list: SessionSummary[], key: SessionSort, dir: SortDir): SessionSummary[] {
  const sign = dir === 'asc' ? 1 : -1;
  // sessions without the value (no location / no cost set yet) always go last
  const missing = (s: SessionSummary) =>
    key === 'location' ? !s.location : key === 'unpaid' ? s.total_cost == null || s.participant_count === 0 : false;
  return [...list].sort((a, b) => {
    const ma = missing(a);
    const mb = missing(b);
    if (ma !== mb) return ma ? 1 : -1;
    const c =
      key === 'location'
        ? (a.location ?? '').localeCompare(b.location ?? '', undefined, { sensitivity: 'base' })
        : key === 'players'
          ? a.participant_count - b.participant_count
          : key === 'unpaid'
            ? unpaidOf(a) - unpaidOf(b)
            : a.date.localeCompare(b.date);
    return c * sign || b.date.localeCompare(a.date);
  });
}

export default function SessionsPage() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'upcoming' | 'past'>(
    params.get('tab') === 'past' ? 'past' : 'upcoming'
  );
  const { data: group } = useCurrentGroup();
  const [sortKey, setSortKey] = useState<SessionSort>('date');
  const [dirOverride, setDirOverride] = useState<SortDir | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions', group?.id],
    queryFn: () => getSessionSummaries(group!.id),
    enabled: !!group,
  });

  const { upcoming, past } = useMemo(
    () => ({
      // API returns newest first: reverse so the next game is on top
      upcoming: sessions.filter((s) => isUpcoming(s.date)).reverse(),
      past: sessions.filter((s) => !isUpcoming(s.date)),
    }),
    [sessions]
  );
  const dir = dirOverride ?? defaultDir(sortKey, tab);
  const shown = useMemo(
    () => sortSessions(tab === 'upcoming' ? upcoming : past, sortKey, dir),
    [tab, upcoming, past, sortKey, dir]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions"
        description="Plan games and see who’s coming."
        actions={
          <Link to="/sessions/new" className={buttonVariants()}>
            <CalendarPlus /> New session
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Session filter"
          value={tab}
          onChange={(t) => {
            setTab(t);
            setDirOverride(null);
          }}
          options={[
            { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { value: 'past', label: 'Past', count: past.length },
          ]}
        />
        <SortControl
          options={[
            { value: 'date', label: 'Date' },
            { value: 'location', label: 'Location' },
            { value: 'players', label: 'Members joined' },
            { value: 'unpaid', label: 'Not paid yet' },
          ]}
          value={sortKey}
          dir={dir}
          onChange={(k) => {
            setSortKey(k);
            setDirOverride(null);
          }}
          onToggleDir={() => setDirOverride(dir === 'asc' ? 'desc' : 'asc')}
        />
      </div>

      {isLoading || !group ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          emoji={tab === 'upcoming' ? '🗓️' : '📜'}
          title={tab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions yet'}
          description={tab === 'upcoming' ? 'Create one and pick who’s coming.' : undefined}
          action={
            tab === 'upcoming' ? (
              <Link to="/sessions/new" className={buttonVariants({ size: 'sm' })}>
                <CalendarPlus /> Create a session
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {shown.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}
