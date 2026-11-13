import { Clock, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SessionSummary } from '../../../shared/types';
import { cn } from '../../../shared/lib/cn';
import {
  dateParts,
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
        </p>
      </div>

      <Badge variant={session.participant_count > 0 ? 'brand' : 'neutral'} className="shrink-0">
        <Users className="size-3.5" /> {session.participant_count}
      </Badge>
    </Link>
  );
}
