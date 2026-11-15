import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Roomier pop-up for forms with more to choose from. */
  wide?: boolean;
}

/**
 * Modal built on the native <dialog> element: focus trap, Esc to close and
 * a backdrop come from the browser, so we need no extra library.
 */
export function Dialog({ open, onClose, title, description, children, wide }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const mouseDownOnBackdrop = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onMouseDown={(e) => {
        mouseDownOnBackdrop.current = e.target === ref.current;
      }}
      onClick={(e) => {
        // Only close if the press started on the backdrop too, so dragging
        // to highlight text outside the box doesn't dismiss the dialog.
        if (mouseDownOnBackdrop.current && e.target === ref.current) {
          onClose();
        }
        mouseDownOnBackdrop.current = false;
      }}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-card border border-border bg-card p-0 text-card-foreground shadow-soft backdrop:bg-ink/50 backdrop:backdrop-blur-sm`}
    >
      {open && (
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold">{title}</h2>
              {description && (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" className="-mr-2 -mt-2" onClick={onClose} aria-label="Close">
              <X />
            </Button>
          </div>
          <div className="mt-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
