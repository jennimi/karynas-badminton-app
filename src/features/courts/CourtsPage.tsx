import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPinned, Minus, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import { Button } from '../../shared/ui/button';
import { Card, CardContent } from '../../shared/ui/card';
import { Skeleton } from '../../shared/ui/skeleton';
import { Tabs } from '../../shared/ui/tabs';
import { formatDate, todayString } from '../../shared/utils/format';
import { useCurrentGroup } from '../groups/hooks';
import { getAvailability, getGroupVenues } from './api';
import { findOptions, toTime, type SearchInput } from './availability';
import { DateStrip } from './components/DateStrip';
import { VenueResultCard, type VenueResult } from './components/VenueResultCard';
import { VenuesDialog } from './components/VenuesDialog';

// ---- Remembered search (per browser), so the usual game is one tap away -----

const PREFS_KEY = 'courtSearch';
const DEFAULTS: SearchInput = { start: '08:00', orLater: true, durationMinutes: 120, courtsWanted: 2, players: 8 };

function loadPrefs(): SearchInput {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<SearchInput>) };
  } catch {
    return DEFAULTS;
  }
}

const START_TIMES = Array.from({ length: 19 }, (_, i) => toTime((i + 5) * 60)); // 05:00 … 23:00
const DURATIONS = [60, 90, 120, 150, 180, 240];
const durationLabel = (minutes: number) => `${minutes / 60} hour${minutes === 60 ? '' : 's'}`;

const selectClass =
  'h-10 w-full rounded-control border border-border bg-card px-3 text-sm font-bold text-foreground focus-visible:outline-2 focus-visible:outline-ring';
const labelClass = 'block text-sm font-bold';

/** − 2 + : a small number picker that works well with a thumb. */
function Stepper({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-1.5">
      <span className={labelClass}>{label}</span>
      <div role="group" aria-label={label} className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          <Minus />
        </Button>
        <span className="w-9 text-center text-lg font-extrabold tabular-nums" aria-live="polite">
          {value}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

export default function CourtsPage() {
  const queryClient = useQueryClient();
  const { data: group } = useCurrentGroup();
  const [date, setDate] = useState(todayString);
  const [input, setInput] = useState<SearchInput>(loadPrefs);
  const [managing, setManaging] = useState(false);
  const set = (patch: Partial<SearchInput>) => setInput((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(input));
    } catch {
      /* storage unavailable: the search still works, it just isn't remembered */
    }
  }, [input]);

  const venuesQuery = useQuery({
    queryKey: ['groupVenues', group?.id],
    queryFn: () => getGroupVenues(group!.id),
    enabled: !!group,
  });
  const venues = useMemo(() => venuesQuery.data ?? [], [venuesQuery.data]);

  // One request per venue per date. Changing time / players / courts re-uses the same answer.
  const availability = useQueries({
    queries: venues.map((v) => ({
      queryKey: ['ayo', v.ayo_venue_id, date],
      queryFn: () => getAvailability(v.ayo_venue_id, date),
      staleTime: 60_000,
    })),
  });

  const results = useMemo(() => {
    const list: VenueResult[] = venues.map((venue, i) => {
      const q = availability[i];
      const data = q?.data;
      return {
        venue,
        loading: !q || q.isPending,
        error: q?.error ? (q.error as Error).message : null,
        closed: data ? !data.open : false,
        courtCount: data?.courts.length ?? 0,
        options: data && data.open ? findOptions(data, input) : [],
      };
    });
    // venues that fit the search first; otherwise keep the group's own order
    const fits = (r: VenueResult) => r.options.some((o) => o.enough);
    return list
      .map((r, i) => ({ r, i }))
      .sort((a, b) => Number(fits(b.r)) - Number(fits(a.r)) || a.i - b.i)
      .map(({ r }) => r);
  }, [venues, availability, input]);

  const checking = availability.some((q) => q.isFetching);
  const fitting = results.filter((r) => r.options.some((o) => o.enough)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courts"
        description="Check your usual venues on AYO in one go."
        actions={
          group && (
            <Button variant="outline" onClick={() => setManaging(true)}>
              <MapPinned /> Venues{venues.length > 0 && ` (${venues.length})`}
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="space-y-5">
          <DateStrip value={date} onChange={setDate} />

          <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
            <div className="min-w-64 flex-1 basis-full space-y-1.5 sm:basis-0">
              <label htmlFor="court-start" className={labelClass}>Start time</label>
              <div className="flex gap-2">
                <select
                  id="court-start"
                  value={input.start}
                  onChange={(e) => set({ start: e.target.value })}
                  className={`${selectClass} min-w-24 flex-1`}
                >
                  {START_TIMES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="shrink-0">
                <Tabs
                  label="Start time flexibility"
                  value={input.orLater ? 'later' : 'exact'}
                  onChange={(v) => set({ orLater: v === 'later' })}
                  options={[
                    { value: 'later', label: 'or later' },
                    { value: 'exact', label: 'exactly' },
                  ]}
                />
                </div>
              </div>
            </div>

            <div className="min-w-36 flex-1 basis-full space-y-1.5 sm:basis-0">
              <label htmlFor="court-duration" className={labelClass}>Duration</label>
              <select
                id="court-duration"
                value={input.durationMinutes}
                onChange={(e) => set({ durationMinutes: Number(e.target.value) })}
                className={selectClass}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>{durationLabel(d)}</option>
                ))}
              </select>
            </div>

            <Stepper label="Courts needed" value={input.courtsWanted} min={1} max={8} onChange={(n) => set({ courtsWanted: n })} />
            <Stepper label="Players" value={input.players} min={1} max={40} onChange={(n) => set({ players: n })} />
          </div>
        </CardContent>
      </Card>

      {!group || venuesQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : venuesQuery.error ? (
        <EmptyState emoji="🛠️" title="Venues couldn’t be loaded" description={(venuesQuery.error as Error).message} />
      ) : venues.length === 0 ? (
        <EmptyState
          emoji="📍"
          title="No venues yet"
          description="Add the places your group usually plays at by pasting their AYO links. After that, one search checks all of them."
          action={
            <Button size="sm" onClick={() => setManaging(true)}>
              <Plus /> Add a venue
            </Button>
          }
        />
      ) : (
        <section className="space-y-3" aria-label="Availability">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold" aria-live="polite">
              {formatDate(date)} ·{' '}
              <span className="text-muted-foreground">
                {checking
                  ? 'checking AYO…'
                  : `${fitting} of ${venues.length} venue${venues.length === 1 ? '' : 's'} can fit you`}
              </span>
            </p>
            <Button
              variant="ghost"
              size="sm"
              disabled={checking}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['ayo'] })}
            >
              <RefreshCw className={checking ? 'animate-spin' : undefined} /> Refresh
            </Button>
          </div>
          {results.map((r) => (
            <VenueResultCard key={r.venue.id} result={r} input={input} date={date} />
          ))}
        </section>
      )}

      {managing && group && (
        <VenuesDialog
          open
          onClose={() => setManaging(false)}
          groupId={group.id}
          groupName={group.name}
          venues={venues}
        />
      )}
    </div>
  );
}
