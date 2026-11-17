import { cn } from '../../../shared/lib/cn';
import { TITLES, type Held, type TitleKey } from '../titles';

export const titleDef = (key: TitleKey) => TITLES.find((t) => t.key === key)!;

/** A little gold pill for an earned title. Hover (or long-press) shows how it was earned. */
export function TitleChip({ titleKey, value, className }: { titleKey: TitleKey; value?: string; className?: string }) {
  const t = titleDef(titleKey);
  return (
    <span
      title={`${t.how}${value ? ` · ${value}` : ''}`}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full bg-butter-soft px-2.5 py-0.5 text-xs font-extrabold text-butter-strong',
        t.hidden && 'ring-1 ring-brand',
        className
      )}
    >
      <span aria-hidden="true">{t.emoji}</span>
      <span className="min-w-0 truncate">{t.name}</span>
      {t.hidden && <span className="sr-only">(secret title)</span>}
    </span>
  );
}

/**
 * Just the emojis of a member's titles, for tight spots next to a name (lists, leaderboard rows).
 * Hover or long-press an emoji for the title name and the number behind it.
 */
export function TitleEmojis({ held, max = 4 }: { held?: Held[]; max?: number }) {
  if (!held || held.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {held.slice(0, max).map((h) => (
        <span
          key={h.key}
          role="img"
          aria-label={titleDef(h.key).name}
          title={`${titleDef(h.key).name}: ${h.value}`}
          className="text-sm leading-none"
        >
          {titleDef(h.key).emoji}
        </span>
      ))}
      {held.length > max && <span className="text-[10px] font-bold text-muted-foreground">+{held.length - max}</span>}
    </span>
  );
}
