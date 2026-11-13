import { UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Alert } from '../../../shared/ui/alert';
import type { Member } from '../../../shared/types';
import { cleanName } from '../../../shared/utils/nameParser';
import { findDuplicate } from '../api';

interface Props {
  existing: Member[];
  onAdd: (name: string) => Promise<void>;
  isLoading: boolean;
}

export default function AddMemberForm({ existing, onAdd, isLoading }: Props) {
  const [name, setName] = useState('');
  const clean = cleanName(name);
  const dupe = clean ? findDuplicate(existing, clean) : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clean || dupe) return;
    try {
      await onAdd(clean);
      setName('');
    } catch {
      /* the page shows the error; keep the typed name */
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <Input
          aria-label="New member name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Member name"
          disabled={isLoading}
          aria-invalid={!!dupe}
        />
        <Button type="submit" disabled={isLoading || !clean || !!dupe}>
          <UserPlus /> Add
        </Button>
      </div>
      {dupe && (
        <Alert>
          <p>“{dupe.name}” is already a member of this group.</p>
          <p className="font-medium">
            Two people with the same name? Add a detail, like “{clean} B.”
          </p>
        </Alert>
      )}
    </form>
  );
}
