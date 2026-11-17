import { UserSearch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Member } from '../../../shared/types';

/**
 * "Check a member": jump to anyone's page and stats. No need to claim to be them ("This is me" is only
 * a label for payments and the activity log).
 */
export function MemberPicker({ members, currentId }: { members: Member[]; currentId?: string }) {
  const navigate = useNavigate();
  const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <label className="inline-flex max-w-full items-center gap-1.5 text-sm font-bold">
      <UserSearch className="size-4 shrink-0 text-brand-strong" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">Check a member</span>
      <select
        value={currentId ?? ''}
        onChange={(e) => e.target.value && navigate(`/members/${e.target.value}`)}
        className="h-9 min-w-0 max-w-44 rounded-control border border-border bg-card px-2.5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-ring"
      >
        {!currentId && <option value="">Pick someone…</option>}
        {sorted.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}
