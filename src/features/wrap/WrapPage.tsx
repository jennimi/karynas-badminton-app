import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Copy, MessageCircle, Play, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { RallyLoader } from '../../shared/components/brand/RallyLoader';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import { cn } from '../../shared/lib/cn';
import type { Member } from '../../shared/types';
import { Avatar } from '../../shared/ui/avatar';
import { FitText } from '../../shared/ui/fit-text';
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
    <div className="wrap-slide relative mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-3 px-6 py-6 text-center">
      <div className="wrap-rise relative flex w-full flex-col items-center gap-3">
        <p className="max-w-full break-words text-xs font-extrabold uppercase tracking-widest opacity-80">{slide.kicker}</p>
        <span className="wrap-pop text-[min(6rem,13dvh)] leading-none" aria-hidden="true">
          {slide.emoji}
        </span>
        <FitText as="h2" lines={2} minPx={18} className="w-full text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
          {slide.headline}
        </FitText>
        {slide.big && (
          <FitText minPx={20} className="w-full text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            {slide.big}
          </FitText>
        )}

        {slide.people && slide.people.length > 0 && (
          <div className="flex -space-x-3" aria-hidden="true">
            {slide.people.map((id) => {
              const m = members.get(id);
              return <Avatar key={id} name={m?.name ?? '?'} emoji={m?.emoji} color={m?.color} className="size-14 text-xl ring-4 sm:size-16" />;
            })}
          </div>
        )}

        {slide.stats && (
          <dl className="grid w-full max-w-sm grid-cols-2 gap-3">
            {slide.stats.map((s) => (
              <div key={s.label} className="min-w-0 rounded-2xl bg-ink/10 px-3 py-4">
                <FitText as="dd" minPx={16} className="text-4xl font-extrabold tabular-nums">
                  {s.value}
                </FitText>
                <dt className="break-words text-xs font-bold opacity-80">{s.label}</dt>
              </div>
            ))}
          </dl>
        )}

        {slide.facts && (
          <ul className="w-full max-w-md space-y-2 text-left">
            {slide.facts.map((f) => (
              <li key={f.text} className="flex items-start gap-3 rounded-2xl bg-ink/10 px-4 py-2.5 text-[clamp(0.75rem,3.6vw,0.875rem)] font-bold">
                <span aria-hidden="true" className="text-lg leading-snug">
                  {f.emoji}
                </span>
                <span className="min-w-0 break-words">{f.text}</span>
              </li>
            ))}
          </ul>
        )}

        {slide.detail && <p className="max-w-sm break-words text-[clamp(0.8rem,3.8vw,0.875rem)] font-bold opacity-85">{slide.detail}</p>}
      </div>
    </div>
  );
}

const ghost =
  'inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-ink/10 px-4 text-sm font-extrabold text-ink transition-colors hover:bg-ink/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-40';

/**
 * The slides, full screen like Instagram stories: tap the right side (or Next / arrow key) to go on, the
 * left side to go back, swipe, or press Esc / the X to close.
 */
function Story({ wrap, members, onClose }: { wrap: Wrap; members: Map<string, Member>; onClose: () => void }) {
  const [i, setI] = useState(0);
  const last = wrap.slides.length - 1;
  const go = (n: number) => setI(Math.max(0, Math.min(last, n)));
  const touchX = useRef<number | null>(null);
  const slide = wrap.slides[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setI((n) => Math.min(last, n + 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // the page underneath must not scroll while the story is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [last, onClose]);

  const shareText = `${wrap.share}\n${window.location.origin}/wrap?month=${wrap.month}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success('Summary copied');
    } catch {
      toast.error('Couldn’t copy automatically.');
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${wrap.label} wrap`}
      className={cn(
        'wrap-screen fixed inset-0 z-[100] flex h-dvh flex-col overflow-hidden text-ink transition-colors duration-300',
        TONE[slide.tone],
        (slide.id === 'intro' || slide.id === 'outro') && 'bg-linear-to-br from-brand via-brand to-lime'
      )}
    >
      {/* soft decoration */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-ink/10" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-12 size-52 rounded-full bg-ink/10" />

      {/* progress + close */}
      <div className="relative z-20 flex items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex flex-1 gap-1" role="group" aria-label="Slides">
          {wrap.slides.map((s, n) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Go to slide ${n + 1} of ${wrap.slides.length}`}
              aria-current={n === i}
              onClick={() => go(n)}
              className="h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-ink/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <span className={cn('block h-full rounded-full bg-ink transition-all duration-300', n <= i ? 'w-full' : 'w-0')} />
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label="Close wrap" className={cn(ghost, 'size-10 shrink-0 px-0')}>
          <X className="size-5" />
        </button>
      </div>

      {/* the slide, with invisible tap zones: left third = back, the rest = next */}
      <div
        className="relative min-h-0 flex-1 overflow-y-auto"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
          touchX.current = null;
        }}
        aria-live="polite"
      >
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => go(i - 1)} className="absolute inset-y-0 left-0 z-10 w-[30%] cursor-w-resize" />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => (i < last ? go(i + 1) : undefined)}
          className="absolute inset-y-0 right-0 z-10 w-[70%] cursor-e-resize"
        />
        <SlideView key={slide.id} slide={slide} members={members} />
      </div>

      {/* controls */}
      <div className="relative z-20 flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        {i === last && (
          <div className="mx-auto flex flex-wrap justify-center gap-2">
            <button type="button" onClick={copy} className={ghost}>
              <Copy className="size-4" /> Copy summary
            </button>
            <button
              type="button"
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener')}
              className={ghost}
            >
              <MessageCircle className="size-4" /> WhatsApp
            </button>
          </div>
        )}
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-2">
          <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous slide" className={ghost}>
            <ChevronLeft className="size-4" /> Back
          </button>
          <span className="text-xs font-extrabold opacity-80">
            {i + 1} / {wrap.slides.length}
          </span>
          {i < last ? (
            <button type="button" onClick={() => go(i + 1)} aria-label="Next slide" className={cn(ghost, 'bg-ink text-brand hover:bg-ink/85')}>
              Next <ChevronRight className="size-4" />
            </button>
          ) : (
            <button type="button" onClick={() => go(0)} className={ghost}>
              <RotateCcw className="size-4" /> Replay
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
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
  // /wrap?month=2026-05 opens that month's story full screen; /wrap alone lists the months
  const asked = params.get('month');
  const month = asked && months.includes(asked) ? asked : undefined;
  const close = useCallback(() => setParams({}, { replace: true }), [setParams]);

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
      <PageHeader title="Monthly Wrap" description="A month of badminton, Spotify-Wrapped style. Pick a month and it opens full screen." />

      {loading ? (
        <RallyLoader message="Putting your wrap together…" />
      ) : months.length === 0 ? (
        <Card>
          <EmptyState emoji="🎁" title="No wraps yet" description="A wrap appears once a month has sessions with players in them." />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Choose a month">
            {months.map((m, n) => (
              <button
                key={m}
                type="button"
                role="listitem"
                onClick={() => setParams({ month: m })}
                className={cn(
                  'group flex min-w-0 cursor-pointer items-center gap-3 rounded-card p-4 text-left text-ink transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  ['bg-brand', 'bg-lime', 'bg-butter', 'bg-coral'][n % 4]
                )}
              >
                <span className="text-3xl" aria-hidden="true">
                  {['🏸', '🔥', '🏆', '✨'][n % 4]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-extrabold">{monthLabel(m)}</span>
                  <span className="block text-xs font-bold opacity-80">{m === today.slice(0, 7) ? 'So far this month' : 'Tap to watch'}</span>
                </span>
                <Play className="size-5 shrink-0 transition-transform group-hover:scale-110" aria-hidden="true" />
              </button>
            ))}
          </div>
          {month && wrap && <Story key={wrap.month} wrap={wrap} members={byId} onClose={close} />}
        </>
      )}
    </div>
  );
}
