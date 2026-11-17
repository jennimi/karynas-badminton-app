import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Copy, MessageCircle, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { RallyLoader } from '../../shared/components/brand/RallyLoader';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import { cn } from '../../shared/lib/cn';
import type { Member } from '../../shared/types';
import { Avatar } from '../../shared/ui/avatar';
import { Button } from '../../shared/ui/button';
import { Card } from '../../shared/ui/card';
import { todayString } from '../../shared/utils/format';
import { useCurrentGroup } from '../groups/hooks';
import { getMembers } from '../members/api';
import { getAttendance, getSessionSummaries } from '../sessions/api';
import { useGames } from '../stats/hooks';
import './wrap.css';
import { buildWrap, monthLabel, wrapMonths, type Slide, type Tone, type Wrap } from './wrap';

// Bright fills with always-dark text (the design system's "ink on accent" rule).
const TONE: Record<Tone, string> = {
  brand: 'bg-brand',
  lime: 'bg-lime',
  butter: 'bg-butter',
  coral: 'bg-coral',
};

function SlideView({ slide, members }: { slide: Slide; members: Map<string, Member> }) {
  return (
    <div
      className={cn(
        'wrap-slide relative flex min-h-[22rem] flex-col items-center justify-center gap-3 overflow-hidden rounded-card px-6 py-10 text-center text-ink sm:min-h-[30rem]',
        TONE[slide.tone],
        (slide.id === 'intro' || slide.id === 'outro') && 'bg-linear-to-br from-brand via-brand to-lime'
      )}
    >
      {/* soft decoration */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-ink/10" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-12 -left-8 size-36 rounded-full bg-ink/10" />

      <div className="wrap-rise relative flex flex-col items-center gap-3">
        <p className="text-xs font-extrabold uppercase tracking-widest opacity-80">{slide.kicker}</p>
        <span className="wrap-pop text-6xl" aria-hidden="true">
          {slide.emoji}
        </span>
        <h2 className="max-w-md text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{slide.headline}</h2>
        {slide.big && <p className="text-4xl font-extrabold tracking-tight sm:text-5xl">{slide.big}</p>}

        {slide.people && slide.people.length > 0 && (
          <div className="flex -space-x-3" aria-hidden="true">
            {slide.people.map((id) => {
              const m = members.get(id);
              return <Avatar key={id} name={m?.name ?? '?'} emoji={m?.emoji} color={m?.color} className="size-16 text-xl ring-4" />;
            })}
          </div>
        )}

        {slide.stats && (
          <dl className="grid w-full max-w-sm grid-cols-2 gap-3">
            {slide.stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-ink/10 px-3 py-4">
                <dd className="text-4xl font-extrabold tabular-nums">{s.value}</dd>
                <dt className="text-xs font-bold opacity-80">{s.label}</dt>
              </div>
            ))}
          </dl>
        )}

        {slide.facts && (
          <ul className="w-full max-w-md space-y-2 text-left">
            {slide.facts.map((f) => (
              <li key={f.text} className="flex items-start gap-3 rounded-2xl bg-ink/10 px-4 py-2.5 text-sm font-bold">
                <span aria-hidden="true" className="text-lg leading-snug">
                  {f.emoji}
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        )}

        {slide.detail && <p className="max-w-sm text-sm font-bold opacity-85">{slide.detail}</p>}
      </div>
    </div>
  );
}

/** The slides, one at a time: tap Next, swipe, or use the arrow keys. */
function Story({ wrap, members }: { wrap: Wrap; members: Map<string, Member> }) {
  const [i, setI] = useState(0);
  const last = wrap.slides.length - 1;
  const go = (n: number) => setI(Math.max(0, Math.min(last, n)));
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') setI((n) => Math.min(last, n + 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last]);

  const shareText = `${wrap.share}\n${window.location.origin}/wrap?month=${wrap.month}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success('Summary copied');
    } catch {
      toast.error('Couldn’t copy automatically.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-3">
      <div className="flex gap-1.5" role="group" aria-label="Slides">
        {wrap.slides.map((s, n) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Go to slide ${n + 1} of ${wrap.slides.length}`}
            aria-current={n === i}
            onClick={() => go(n)}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className={cn('block h-full rounded-full bg-brand transition-all duration-300', n <= i ? 'w-full' : 'w-0')} />
          </button>
        ))}
      </div>

      <div
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
          touchX.current = null;
        }}
        aria-live="polite"
      >
        <SlideView key={wrap.slides[i].id} slide={wrap.slides[i]} members={members} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous slide">
          <ChevronLeft /> Back
        </Button>
        <span className="text-xs font-bold text-muted-foreground">
          {i + 1} / {wrap.slides.length}
        </span>
        {i < last ? (
          <Button onClick={() => go(i + 1)} aria-label="Next slide">
            Next <ChevronRight />
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => go(0)}>
            <RotateCcw /> Replay
          </Button>
        )}
      </div>

      {i === last && (
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Button onClick={copy}>
            <Copy /> Copy summary
          </Button>
          <Button variant="lime" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener')}>
            <MessageCircle /> WhatsApp
          </Button>
        </div>
      )}
    </div>
  );
}

export default function WrapPage() {
  const { data: group } = useCurrentGroup();
  const gid = group?.id;
  const [params, setParams] = useSearchParams();
  const today = todayString();

  const sessions = useQuery({ queryKey: ['sessions', gid], queryFn: () => getSessionSummaries(gid!), enabled: !!gid });
  const attendance = useQuery({ queryKey: ['attendance', gid], queryFn: () => getAttendance(gid!), enabled: !!gid });
  const members = useQuery({ queryKey: ['members', gid], queryFn: () => getMembers(gid!), enabled: !!gid });
  // if the matches table isn't there yet the wrap still works from attendance
  const games = useGames(gid);

  const months = useMemo(() => wrapMonths(sessions.data ?? [], today), [sessions.data, today]);
  const asked = params.get('month');
  const month = asked && months.includes(asked) ? asked : months[0];

  const byId = useMemo(() => new Map((members.data ?? []).map((m) => [m.id, m])), [members.data]);
  const wrap = useMemo(
    () =>
      month && sessions.data
        ? buildWrap({
            month,
            sessions: sessions.data,
            attendance: attendance.data ?? [],
            games: games.data ?? [],
            nameOf: (id) => byId.get(id)?.name ?? 'Someone',
            today,
          })
        : null,
    [month, sessions.data, attendance.data, games.data, byId, today]
  );

  const loading = !gid || sessions.isLoading || attendance.isLoading || members.isLoading;

  return (
    <div className="space-y-5">
      <PageHeader title="Monthly Wrap" description="A month of badminton, Spotify-Wrapped style." />

      {loading ? (
        <RallyLoader message="Putting your wrap together…" />
      ) : months.length === 0 ? (
        <Card>
          <EmptyState emoji="🎁" title="No wraps yet" description="A wrap appears once a month has sessions with players in them." />
        </Card>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Choose a month">
            {months.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={m === month}
                onClick={() => setParams({ month: m }, { replace: true })}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  m === month ? 'bg-brand text-ink' : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {monthLabel(m).replace(/ 20(\d\d)$/, " '$1")}
                {m === today.slice(0, 7) && <span className="ml-1 font-semibold opacity-70">· so far</span>}
              </button>
            ))}
          </div>
          {wrap && <Story key={wrap.month} wrap={wrap} members={byId} />}
        </>
      )}
    </div>
  );
}
