import { cn } from '../lib/cn';

const tones = [
  'bg-brand-soft text-brand-strong',
  'bg-lime-soft text-lime-strong',
  'bg-butter-soft text-butter-strong',
  'bg-coral-soft text-coral-strong',
];

/** Same name always gets the same colour. */
function toneFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return tones[hash % tones.length];
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function Avatar({
  name,
  className,
  compact = false,
}: {
  name: string;
  className?: string;
  /** Show only the first initial (for small or overlapping avatars). */
  compact?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ring-2 ring-card',
        toneFor(name),
        className
      )}
    >
      {compact ? initialsOf(name)[0] : initialsOf(name)}
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
