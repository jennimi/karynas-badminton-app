import { cn } from '../lib/cn';

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}

/** Pill-style segmented control, e.g. Upcoming | Past. */
export function Tabs<T extends string>({ value, onChange, options, label }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex rounded-control bg-muted p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'cursor-pointer rounded-[0.65rem] px-4 py-1.5 text-sm font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            value === o.value
              ? 'bg-card text-foreground shadow-soft'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <>
              {' '}
              <span className="text-xs text-muted-foreground">{o.count}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
