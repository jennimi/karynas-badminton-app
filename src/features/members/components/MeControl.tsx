import { useQuery } from '@tanstack/react-query';
import { Search, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../../../shared/lib/cn';
import type { Member } from '../../../shared/types';
import { Avatar } from '../../../shared/ui/avatar';
import { Button, buttonVariants } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { Input } from '../../../shared/ui/input';
import { useCurrentGroup } from '../../groups/hooks';
import { getMembers } from '../api';
import { useMe } from '../useMe';

/** "Who are you?": pick yourself from the group's members. */
function MePickerDialog({
  members,
  onPick,
  onClose,
}: {
  members: Member[];
  onPick: (member: Member) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const shown = members.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Dialog
      open
      onClose={onClose}
      title="Who are you?"
      description="Pick your name. It’s remembered in this tab only, until you close it."
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search members"
            placeholder="Search your name…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {members.length === 0 ? 'This group has no members yet.' : `No one matches “${query}”.`}
          </p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {shown.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onPick(m)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left text-sm font-bold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Avatar name={m.name} emoji={m.emoji} color={m.color} />
                  <span className="truncate">{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

/**
 * The "me" button in the sidebar / phone header. Not picked yet: opens the picker.
 * Picked: shows you and links to your own page (where you can switch back off).
 */
export function MeControl() {
  const { data: group } = useCurrentGroup();
  const me = useMe(group?.id);
  const [picking, setPicking] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ['members', group?.id],
    queryFn: () => getMembers(group!.id),
    enabled: !!group,
  });
  const mine = members.find((m) => m.id === me.memberId);
  const layout = 'min-w-0 px-2 lg:w-full lg:justify-start lg:px-3';

  return (
    <>
      {mine ? (
        <Link
          to={`/members/${mine.id}`}
          aria-label={`You are ${mine.name}. Open your page`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), layout, 'lg:h-11')}
        >
          <Avatar name={mine.name} emoji={mine.emoji} color={mine.color} className="size-6 text-[10px] ring-0" compact />
          <span className="hidden truncate lg:inline">{mine.name}</span>
        </Link>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className={cn(layout, 'lg:h-11')}
          disabled={!group}
          onClick={() => setPicking(true)}
          aria-label="Choose which member you are"
        >
          <UserRound />
          <span className="hidden lg:inline">Who are you?</span>
        </Button>
      )}
      {picking && (
        <MePickerDialog
          members={members}
          onClose={() => setPicking(false)}
          onPick={(m) => {
            me.become(m.id);
            setPicking(false);
            toast.success(`Hi ${m.name} 👋`);
          }}
        />
      )}
    </>
  );
}
