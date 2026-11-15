import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Member } from '../../../shared/types';
import { Avatar } from '../../../shared/ui/avatar';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import type { MemberTypeResult } from '../memberType';
import { MemberTypeBadge } from './MemberTypeBadge';

interface Props {
  members: Member[];
  types: Map<string, MemberTypeResult>;
  /** The member this browser tab is "being" (see useMe): gets a You label. */
  meId?: string | null;
  /** Only given to admins: without it, the Remove button isn't shown. */
  onDelete?: (member: Member) => void;
  onRename: (id: string, newName: string) => void;
}

export default function MemberList({ members, types, meId, onDelete, onRename }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startEdit = (m: Member) => {
    setEditingId(m.id);
    setEditName(m.name);
  };

  const save = (e: FormEvent, m: Member) => {
    e.preventDefault();
    const next = editName.trim();
    if (next && next !== m.name) onRename(m.id, next);
    setEditingId(null);
  };

  return (
    <ul className="divide-y divide-border">
      {members.map((m) => (
        <li key={m.id} className="flex items-center gap-3 px-2 py-3">
          <Avatar name={m.name} emoji={m.emoji} color={m.color} />
          {editingId === m.id ? (
            <form onSubmit={(e) => save(e, m)} className="flex flex-1 items-center gap-2">
              <Input
                aria-label={`Rename ${m.name}`}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                className="h-9"
              />
              <Button type="submit" size="icon" variant="lime" className="size-9" aria-label="Save name">
                <Check />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-9"
                aria-label="Cancel"
                onClick={() => setEditingId(null)}
              >
                <X />
              </Button>
            </form>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    to={`/members/${m.id}`}
                    className="truncate rounded font-bold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {m.name}
                  </Link>
                  {m.id === meId && <Badge variant="brand">You</Badge>}
                  <MemberTypeBadge result={types.get(m.id)} />
                </div>
                {types.get(m.id) && (
                  <p className="mt-1 max-w-prose text-xs leading-snug text-muted-foreground">{types.get(m.id)!.why}</p>
                )}
              </div>
              <div
                className="w-16 shrink-0 text-center"
                title="Sessions joined so far"
              >
                <span className="block text-lg font-extrabold leading-none">{types.get(m.id)?.played ?? 0}</span>
                <span className="mt-1 block text-[11px] font-semibold text-muted-foreground">sessions</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="size-9"
                aria-label={`Rename ${m.name}`}
                onClick={() => startEdit(m)}
              >
                <Pencil />
              </Button>
              {onDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="size-9 hover:bg-coral-soft hover:text-coral-strong"
                aria-label={`Remove ${m.name}`}
                onClick={() => onDelete(m)}
              >
                <Trash2 />
              </Button>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
