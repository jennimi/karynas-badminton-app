import { useLayoutEffect, useRef, type ElementType, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * Text that shrinks its font until it fits, instead of overflowing or being cut off. Give it the
 * normal (biggest) size with a class like `text-4xl`; on a narrow phone it steps down from there,
 * never below `minPx`. `lines` is how many lines it may use (default 1: it never wraps).
 */
export function FitText({
  as: Tag = 'p',
  lines = 1,
  minPx = 11,
  className,
  children,
}: {
  as?: ElementType;
  lines?: number;
  minPx?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = ''; // back to the class's size, then measure
      let size = parseFloat(getComputedStyle(el).fontSize);
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) / size || 1.2;
      const tooBig = () => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > lines * size * lineHeight + 2;
      let guard = 40;
      while (tooBig() && size > minPx && guard-- > 0) {
        size = Math.max(minPx, size * 0.92);
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    // refit when the box changes width (rotating a phone, resizing the window)
    const parent = el.parentElement;
    let lastWidth = parent?.clientWidth ?? 0;
    const ro = new ResizeObserver(() => {
      const w = parent?.clientWidth ?? 0;
      if (w !== lastWidth) {
        lastWidth = w;
        fit();
      }
    });
    if (parent) ro.observe(parent);
    return () => ro.disconnect();
  }, [children, lines, minPx]);

  return (
    <Tag ref={ref} className={cn('min-w-0 max-w-full', lines === 1 ? 'overflow-hidden whitespace-nowrap' : 'break-words', className)}>
      {children}
    </Tag>
  );
}
