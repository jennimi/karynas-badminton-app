import { cn } from '../../../shared/lib/cn';
import { TITLES, type TitleKey } from '../titles';

export const titleDef = (key: TitleKey) => TITLES.find((t) => t.key === key)!;

/** A little gold pill for an earned title. Hover (or long-press) shows how it was earned. */
export function TitleChip({ titleKey, value, className }: { titleKey: TitleKey; value?: string; className?: string }) {
  const t = titleDef(titleKey);
  return (
    <span
      title={`${t.how}${value ? ` · ${value}` : ''}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-butter-soft px-2.5 py-0.5 text-xs font-extrabold text-butter-strong',
        className
      )}
    >
      <span aria-hidden="true">{t.emoji}</span>
      {t.name}
    </span>
  );
}
