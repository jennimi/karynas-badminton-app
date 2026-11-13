import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/** Pulsing placeholder shown while data loads. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-2xl bg-muted', className)}
      {...props}
    />
  );
}
