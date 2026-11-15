import { CalendarPlus, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../../shared/lib/cn';
import type { GroupVenue } from '../../../shared/types';
import { Badge } from '../../../shared/ui/badge';
import { buttonVariants } from '../../../shared/ui/button';
import { Card } from '../../../shared/ui/card';
import { Skeleton } from '../../../shared/ui/skeleton';
import { formatCourts, formatMoney } from '../../../shared/utils/format';
import { ayoVenueUrl } from '../api';
import type { Option, SearchInput } from '../availability';

/** AYO writes midnight as 24:00; people read it as 00:00. */
const clock = (time: string) => (time === '24:00' ? '00:00' : time);

export interface VenueResult {
  venue: GroupVenue;
  loading: boolean;
  error: string | null;
  /** venue closed that day */
  closed: boolean;
  /** how many badminton courts the venue has in total */
  courtCount: number;
  options: Option[];
}

/** Link to the new-session form, filled in with this slot (nothing is saved until it's confirmed there). */
function newSessionLink(venue: GroupVenue, date: string, option: Option, input: SearchInput): string {
  const picked = option.courts.slice(0, input.courtsWanted);
  const params = new URLSearchParams({
    date,
    start: option.start,
    end: clock(option.end),
    location: venue.name,
    courts: String(picked.length),
    notes: picked.map((c) => c.name).join(', '),
  });
  return `/sessions/new?${params}`;
}

function OptionRow({ option, input, venue, date }: { option: Option; input: SearchInput; venue: GroupVenue; date: string }) {
  const free = option.courts.length;
  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3', !option.enough && 'opacity-70')}>
      <div className="w-28 shrink-0">
        <p className="font-extrabold tabular-nums">
          {clock(option.start)} – {clock(option.end)}
        </p>
      </div>

      <div className="min-w-0 flex-1 basis-48">
        <Badge variant={option.enough ? 'lime' : free > 0 ? 'butter' : 'coral'}>
          {free === 0 ? 'No courts free' : `${formatCourts(free)} free`}
          {!option.enough && free > 0 && ` · need ${input.courtsWanted}`}
        </Badge>
        {free > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">{option.courts.map((c) => c.name).join(', ')}</p>
        )}
      </div>

      {free > 0 && (
        <div className="shrink-0 text-right">
          <p className="font-extrabold tabular-nums">
            {formatMoney(Math.round(option.perPerson))}
            <span className="text-xs font-semibold text-muted-foreground"> / person</span>
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatMoney(option.total)} for {formatCourts(Math.min(free, input.courtsWanted))}
          </p>
        </div>
      )}

      {option.enough && (
        <Link
          to={newSessionLink(venue, date, option, input)}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
          aria-label={`Create a session at ${venue.name}, ${clock(option.start)} to ${clock(option.end)}`}
        >
          <CalendarPlus /> Create session
        </Link>
      )}
    </li>
  );
}

/** One venue: its name, a link to book, and every start time that fits the search. */
export function VenueResultCard({ result, input, date }: { result: VenueResult; input: SearchInput; date: string }) {
  const { venue, loading, error, closed, courtCount, options } = result;
  const matches = options.filter((o) => o.enough).length;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-extrabold">{venue.name}</h3>
          {!loading && !error && (
            <p className="text-xs text-muted-foreground">
              {closed
                ? 'Closed this day'
                : courtCount === 0
                  ? 'No badminton courts listed on AYO'
                  : `${formatCourts(courtCount)} in total`}
            </p>
          )}
        </div>
        <a
          href={ayoVenueUrl(venue.ayo_slug)}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: matches > 0 ? 'secondary' : 'outline', size: 'sm' })}
        >
          Book on AYO <ExternalLink />
        </a>
      </div>

      {loading ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-12" />
        </div>
      ) : error ? (
        <p className="px-5 pb-5 text-sm text-coral-strong">{error}</p>
      ) : options.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">
          {closed || courtCount === 0
            ? 'Nothing to book here.'
            : `No start time from ${clock(input.start)} with ${formatCourts(input.courtsWanted)} free for the whole game.`}
        </p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {options.map((o) => (
            <OptionRow key={o.start} option={o} input={input} venue={venue} date={date} />
          ))}
        </ul>
      )}
    </Card>
  );
}
