import { AlertTriangle, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Inline notice. `warning` for duplicates / things to double-check. */
export function Alert({
  tone = 'warning',
  children,
  className,
}: {
  tone?: 'warning' | 'info';
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === 'warning' ? AlertTriangle : Info;
  return (
    <div
      role={tone === 'warning' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-2xl px-3 py-2 text-sm font-semibold',
        tone === 'warning' ? 'bg-butter-soft text-butter-strong' : 'bg-brand-soft text-brand-strong',
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">{children}</div>
    </div>
  );
}
