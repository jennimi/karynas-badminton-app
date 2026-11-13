import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import { Card } from '../ui/card';

const tones = {
  brand: 'bg-brand-soft text-brand-strong',
  lime: 'bg-lime-soft text-lime-strong',
  butter: 'bg-butter-soft text-butter-strong',
  coral: 'bg-coral-soft text-coral-strong',
} as const;

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: keyof typeof tones;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'brand',
}: StatCardProps) {
  return (
    <Card className="flex items-center gap-3 p-4 sm:gap-4 transition-transform duration-200 hover:-translate-y-0.5">
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-2xl sm:size-12',
          tones[tone]
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-2xl font-extrabold leading-tight">{value}</p>
        <p className="text-sm font-semibold leading-tight text-muted-foreground">
          {label}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}
