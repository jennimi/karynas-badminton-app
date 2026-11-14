import { cn } from '../../lib/cn';
import { RallyMark } from './RallyLogo';
import type { RallyIconId } from './rallyIcons';

/**
 * The loading screen: the Rally icon hopping with a short message.
 * Use it for page-sized waits (instead of a wall of skeletons); keep Skeleton
 * for small placeholders inside a layout.
 */
export function RallyLoader({
  message = 'Loading…',
  icon,
  size = 72,
  className,
}: {
  message?: string;
  icon?: RallyIconId;
  size?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}
    >
      {/* room above for the hop; the shadow stays on the ground */}
      <div className="flex flex-col items-center pt-6" style={{ width: size }}>
        <RallyMark icon={icon} size={size} motion="loop" />
        <span
          className="rally-shadow mt-1.5 block h-2 w-3/4 rounded-full bg-ink"
          aria-hidden="true"
        />
      </div>
      <p className="rally-loader-text text-sm font-bold text-muted-foreground">{message}</p>
    </div>
  );
}
