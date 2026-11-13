import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { cn } from '../../../shared/lib/cn';
import type { Group } from '../../../shared/types';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { Field } from '../../../shared/ui/field';
import { Input } from '../../../shared/ui/input';
import { createGroup, updateGroup } from '../api';

const presets = ['🏸', '🔥', '⚡', '🌟', '🏆', '🎯', '🦋', '🐉'];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pass a group to edit it; omit to create a new one. */
  group?: Group;
  onSaved?: (group: Group) => void;
}

export function GroupDialog({ open, onClose, group, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(group?.name ?? '');
  const [emoji, setEmoji] = useState(group?.emoji ?? '🏸');

  const mutation = useMutation({
    mutationFn: () =>
      group ? updateGroup(group.id, { name, emoji }) : createGroup({ name, emoji }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group', saved.id] });
      queryClient.invalidateQueries({ queryKey: ['currentGroup'] });
      toast.success(group ? 'Group updated' : `${saved.name} created 🎉`);
      onSaved?.(saved);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={group ? 'Edit group' : 'Create a group'}
      description="Pick a name and an emoji your members will recognise."
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Group name" htmlFor="group-name">
          <Input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Friday Shuttlers"
            autoFocus
            required
          />
        </Field>

        <Field label="Emoji" htmlFor="group-emoji">
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setEmoji(p)}
                aria-label={`Use ${p}`}
                aria-pressed={emoji === p}
                className={cn(
                  'flex size-10 cursor-pointer items-center justify-center rounded-control border text-xl transition-all hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  emoji === p ? 'border-brand bg-brand-soft' : 'border-border bg-card'
                )}
              >
                {p}
              </button>
            ))}
            <Input
              id="group-emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={8}
              className="w-20 text-center text-lg"
              aria-label="Custom emoji"
            />
          </div>
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || !name.trim()}>
            {mutation.isPending ? 'Saving…' : group ? 'Save changes' : 'Create group'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
