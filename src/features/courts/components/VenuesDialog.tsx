import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { GroupVenue } from '../../../shared/types';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { Field } from '../../../shared/ui/field';
import { Input } from '../../../shared/ui/input';
import { addGroupVenue, ayoVenueUrl, removeGroupVenue } from '../api';

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  venues: GroupVenue[];
}

/** The group's shortlist of venues: add one by pasting its AYO link, or remove one. */
export function VenuesDialog({ open, onClose, groupId, groupName, venues }: Props) {
  const queryClient = useQueryClient();
  const [link, setLink] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['groupVenues', groupId] });

  const add = useMutation({
    mutationFn: () => addGroupVenue(groupId, link),
    onSuccess: (venue) => {
      setLink('');
      toast.success(`${venue.name} added`);
      return refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (venue: GroupVenue) => removeGroupVenue(venue.id),
    onSuccess: (_, venue) => {
      toast.success(`${venue.name} removed`);
      return refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (link.trim()) add.mutate();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Venues"
      description={`The places ${groupName} usually plays at. Only these are checked.`}
    >
      <div className="space-y-5">
        {venues.length > 0 && (
          <ul className="space-y-2">
            {venues.map((v) => (
              <li key={v.id} className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{v.name}</p>
                  <a
                    href={ayoVenueUrl(v.ayo_slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <span className="truncate">ayo.co/v/{v.ayo_slug}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${v.name}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(v)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} className="space-y-3">
          <Field label="Add a venue" htmlFor="venue-link" hint="paste its AYO link">
            <Input
              id="venue-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://ayo.co/v/weston-sports"
              inputMode="url"
              autoFocus={venues.length === 0}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Done</Button>
            <Button type="submit" disabled={add.isPending || !link.trim()}>
              <Plus /> {add.isPending ? 'Looking it up…' : 'Add venue'}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
