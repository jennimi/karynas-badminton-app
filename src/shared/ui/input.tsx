import type { InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export function Input({
  className,
  type = 'text',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        'h-10 w-full rounded-control border border-border bg-card px-3.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}
