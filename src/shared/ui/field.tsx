import type { ReactNode } from 'react';

/** Label + control (+ optional hint) with correct accessibility wiring. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
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
