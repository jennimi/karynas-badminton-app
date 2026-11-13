import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../../shared/lib/cn';
import { Skeleton } from '../../../shared/ui/skeleton';
import { getGroups } from '../api';
import { setCurrentGroupId, useCurrentGroup } from '../hooks';
import { GroupDialog } from './GroupDialog';

/** Sidebar picker for the current group. Sessions, Members, … follow this choice. */
export function GroupSwitcher() {
  const navigate = useNavigate();
  const { data: group, isLoading } = useCurrentGroup();
  const { data: groups = [] } = useQuery({ queryKey: ['groups'], queryFn: getGroups });
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (isLoading || !group) return <Skeleton className="h-14" />;
  const count = groups.find((g) => g.id === group.id)?.member_count;

  const pick = (id: string) => {
    setCurrentGroupId(id);
    setOpen(false);
    navigate(`/groups/${id}`);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Current group: ${group.name}. Switch group`}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-control border border-border bg-background p-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lime-soft text-lg">
          {group.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold">{group.name}</span>
          {count !== undefined && (
            <span className="block text-xs text-muted-foreground">{count} members</span>
          )}
        </span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 rounded-control border border-border bg-card p-1 shadow-soft">
          <ul role="listbox" aria-label="Groups" className="max-h-72 overflow-y-auto">
            {groups.map((g) => {
              const active = g.id === group.id;
              return (
                <li key={g.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => pick(g.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-bold hover:bg-muted',
                      active && 'bg-brand-soft text-brand-strong'
                    )}
                  >
                    <span className="text-base">{g.emoji}</span>
                    <span className="min-w-0 flex-1 truncate">{g.name}</span>
                    {active && <Check className="size-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
            className="mt-1 flex w-full items-center gap-2.5 border-t border-border px-2 pb-1.5 pt-2.5 text-left text-sm font-bold text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-4" /> New group
          </button>
        </div>
      )}

      {creating && (
        <GroupDialog open onClose={() => setCreating(false)} onSaved={(g) => pick(g.id)} />
      )}
    </div>
  );
}
