import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { cn } from '../../../shared/lib/cn';
import { addDays, todayString } from '../../../shared/utils/format';

const DAYS_AHEAD = 45;

/** Sideways-scrolling row of upcoming days: swipe (or use the arrows) and tap one. */
export function DateStrip({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const today = todayString();
  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i)), [today]);
  const scroller = useRef<HTMLDivElement>(null);

  // keep the chosen day in view (e.g. when the page opens on a remembered date)
  useEffect(() => {
    scroller.current
      ?.querySelector<HTMLElement>(`[data-date="${value}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);

  const scrollBy = (direction: 1 | -1) =>
    scroller.current?.scrollBy({ left: direction * scroller.current.clientWidth * 0.8, behavior: 'smooth' });

  const arrow =
    'hidden size-9 shrink-0 cursor-pointer items-center justify-center rounded-control border border-border bg-card hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:flex';

  return (
    <div className="flex items-center gap-2">
      <button type="button" className={arrow} onClick={() => scrollBy(-1)} aria-label="Earlier dates">
        <ChevronLeft className="size-4" />
      </button>
      <div
        ref={scroller}
        role="group"
        aria-label="Date"
        className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto scroll-smooth px-0.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {days.map((date, i) => {
          const d = new Date(date + 'T00:00:00');
          const selected = date === value;
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              aria-pressed={selected}
              aria-label={d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              onClick={() => onChange(date)}
              className={cn(
                'flex w-14 shrink-0 cursor-pointer snap-start flex-col items-center rounded-control border py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                selected
                  ? 'border-brand bg-brand text-ink shadow-soft'
                  : 'border-border bg-card hover:bg-muted'
              )}
            >
              <span
                className={cn(
                  'text-[11px] font-bold',
                  selected ? 'text-ink' : weekend ? 'text-coral-strong' : 'text-muted-foreground'
                )}
              >
                {i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' })}
              </span>
              <span className="text-lg font-extrabold leading-tight">{d.getDate()}</span>
              <span className={cn('text-[11px] font-semibold', selected ? 'text-ink' : 'text-muted-foreground')}>
                {d.toLocaleDateString('en-GB', { month: 'short' })}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" className={arrow} onClick={() => scrollBy(1)} aria-label="Later dates">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
