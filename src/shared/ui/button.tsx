import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-control font-bold transition-all duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /** Main call to action — one per screen is plenty. */
        primary: 'bg-brand text-ink shadow-soft hover:bg-brand/85',
        /** Calm alternative next to a primary button. */
        secondary: 'bg-brand-soft text-brand-strong hover:bg-brand-soft/60',
        /** Positive / "go" actions (confirm, approve). */
        lime: 'bg-lime text-ink shadow-soft hover:bg-lime/85',
        outline: 'border border-border bg-card hover:bg-muted',
        ghost: 'hover:bg-muted',
        /** Destructive actions (delete, remove). */
        danger: 'bg-coral-soft text-coral-strong hover:bg-coral/35',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
