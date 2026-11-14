import { cn } from '../../lib/cn';
import './rally.css';
import { iconSrc, useRallyIcon, type RallyIconId } from './rallyIcons';

/** none = still, hover = one hop while hovered, loop = hops forever (loading screens). */
export type RallyMotion = 'none' | 'hover' | 'loop';

interface MarkProps {
  /** Show this icon instead of the app's chosen one (used for previews). */
  icon?: RallyIconId;
  /** pixel size (width = height) */
  size?: number;
  motion?: RallyMotion;
  className?: string;
  /** Accessible name. Leave out when the mark sits next to the word "Rally". */
  label?: string;
}

/** The app icon: whichever of the 12 icons is chosen (see rallyIcons.ts). */
export function RallyMark({ icon, size = 36, motion = 'none', className, label }: MarkProps) {
  const chosen = useRallyIcon();
  return (
    <img
      src={iconSrc(icon ?? chosen)}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      data-motion={motion}
      className={cn('rally shrink-0 select-none', className)}
    />
  );
}

interface LogoProps extends Omit<MarkProps, 'label'> {
  /** Show the word "Rally" next to the icon. */
  wordmark?: boolean;
  textClassName?: string;
}

/** Icon + the word "Rally". The wrapper is also what makes `motion="hover"` work. */
export function RallyLogo({ wordmark = true, size = 36, textClassName, className, ...mark }: LogoProps) {
  return (
    <span className={cn('rally-host inline-flex items-center gap-2.5', className)}>
      <RallyMark size={size} {...mark} />
      {wordmark && (
        <span className={cn('font-extrabold tracking-tight', textClassName)} style={{ fontSize: Math.round(size * 0.55) }}>
          Rally
        </span>
      )}
    </span>
  );
}
