import { useQuery } from '@tanstack/react-query';
import { CalendarPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import { buttonVariants } from '../../shared/ui/button';
import { Skeleton } from '../../shared/ui/skeleton';
import { Tabs } from '../../shared/ui/tabs';
import { isUpcoming } from '../../shared/utils/format';
import { useCurrentGroup } from '../groups/hooks';
import { getSessionSummaries } from './api';
import { SessionCard } from './components/SessionCard';

export default function SessionsPage() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const { data: group } = useCurrentGroup();

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
  const shown = tab === 'upcoming' ? upcoming : past;

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

      <Tabs
        label="Session filter"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { value: 'past', label: 'Past', count: past.length },
        ]}
      />

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
