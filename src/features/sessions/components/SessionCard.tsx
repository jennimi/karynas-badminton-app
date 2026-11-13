import { Clock, LayoutGrid, MapPin, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SessionSummary } from '../../../shared/types';
import { cn } from '../../../shared/lib/cn';
import {
  dateParts,
  formatCourts,
  formatDate,
  formatTimeRange,
  isUpcoming,
  relativeDay,
} from '../../../shared/utils/format';
import { Badge } from '../../../shared/ui/badge';

/** One session row/card. Used on the dashboard, group page and sessions list. */
export function SessionCard({ session }: { session: SessionSummary }) {
  const upcoming = isUpcoming(session.date);
  const { day, month } = dateParts(session.date);
  const rel = relativeDay(session.date);
  const soon = rel === 'Today' || rel === 'Tomorrow';
  const time = formatTimeRange(session.start_time, session.end_time);

  return (
    <Link
      to={`/sessions/${session.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div
        className={cn(
          'flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl',
          upcoming ? 'bg-butter-soft text-butter-strong' : 'bg-muted text-muted-foreground'
        )}
      >
        <span className="text-lg font-extrabold leading-none">{day}</span>
        <span className="text-[11px] font-bold uppercase">{month}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-extrabold">
            {session.title || formatDate(session.date)}
          </h3>
          {upcoming && soon && <Badge variant="coral">{rel}</Badge>}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {session.title && <span>{formatDate(session.date)}</span>}
          {time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {time}
            </span>
          )}
          {session.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> {session.location}
            </span>
          )}
          {session.courts && (
            <span className="inline-flex items-center gap-1">
              <LayoutGrid className="size-3.5" /> {formatCourts(session.courts)}
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Badge variant={session.participant_count > 0 ? 'brand' : 'neutral'}>
          <Users className="size-3.5" /> {session.participant_count}
        </Badge>
        {session.participant_count > 0 && session.total_cost != null && (
          <Badge
            variant={session.approved_count === session.participant_count ? 'lime' : 'butter'}
            aria-label={`${session.approved_count} of ${session.participant_count} paid`}
            title={`${session.approved_count} approved, ${session.pending_count} waiting approval`}
          >
            <Wallet className="size-3.5" /> {session.approved_count}/{session.participant_count}
          </Badge>
        )}
      </div>
    </Link>
  );
}
