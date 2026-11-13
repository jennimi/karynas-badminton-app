import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Label + control (+ optional hint) with correct accessibility wiring. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-bold">
        {label}
        {hint && (
          <span className="ml-1.5 text-xs font-semibold text-muted-foreground">
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
