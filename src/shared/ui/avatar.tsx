import { cleanName } from '../utils/nameParser';
import { cn } from '../lib/cn';

export const avatarTones = {
  brand: 'bg-brand-soft text-brand-strong',
  lime: 'bg-lime-soft text-lime-strong',
  butter: 'bg-butter-soft text-butter-strong',
  coral: 'bg-coral-soft text-coral-strong',
} as const;
export type AvatarColor = keyof typeof avatarTones;
const tones = Object.values(avatarTones);

/** Same name always gets the same colour. */
function toneFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return tones[hash % tones.length];
}

function initialsOf(name: string) {
  const parts = cleanName(name).split(' ').filter(Boolean);
  const first = (w?: string) => (w ? Array.from(w)[0] : '');
  return (first(parts[0]) + first(parts[1])).toUpperCase() || '?';
}

export function Avatar({
  name,
  emoji,
  color,
  className,
  compact = false,
}: {
  name: string;
  /** The member's chosen emoji: shown instead of their initials. */
  emoji?: string | null;
  /** The member's chosen background colour; without it the colour comes from the name. */
  color?: AvatarColor | null;
  className?: string;
  /** Show only the first initial (for small or overlapping avatars). */
  compact?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ring-2 ring-card',
        (color && avatarTones[color]) || toneFor(name),
        className
      )}
    >
      {emoji ? (
        <span className="text-[1.35em] leading-none">{emoji}</span>
      ) : compact ? (
        Array.from(initialsOf(name))[0]
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

/** Overlapping avatars, e.g. session attendees. */
export function AvatarStack({
  names,
  extra = 0,
}: {
  names: string[];
  extra?: number;
}) {
  return (
    <div className="flex -space-x-2">
      {names.map((n) => (
        <Avatar key={n} name={n} compact className="size-7 text-[10px]" />
      ))}
      {extra > 0 && (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-extrabold text-muted-foreground ring-2 ring-card">
          +{extra}
        </span>
      )}
    </div>
  );
}
