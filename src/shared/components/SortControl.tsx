import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '../lib/cn';

export type SortDir = 'asc' | 'desc';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  dir: SortDir;
  onChange: (value: T) => void;
  onToggleDir: () => void;
  className?: string;
}

/** "Sort by [name ▾] [↑]": pick what to sort by and flip the direction. */
export function SortControl<T extends string>({ options, value, dir, onChange, onToggleDir, className }: Props<T>) {
  const label = options.find((o) => o.value === value)?.label ?? '';
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
        Sort by
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="h-9 rounded-control border border-border bg-card px-2.5 text-sm font-bold text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onToggleDir}
        aria-label={`Sorted by ${label}, ${dir === 'asc' ? 'ascending' : 'descending'}. Click to reverse`}
        title={dir === 'asc' ? 'Ascending (click to reverse)' : 'Descending (click to reverse)'}
        className="flex size-9 items-center justify-center rounded-control border border-border bg-card hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      >
        {dir === 'asc' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
      </button>
    </div>
  );
}
