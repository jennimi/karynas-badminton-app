import { UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';

interface Props {
  onAdd: (name: string) => Promise<void>;
  isLoading: boolean;
}

export default function AddMemberForm({ onAdd, isLoading }: Props) {
  const [name, setName] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await onAdd(name.trim());
      setName('');
    } catch {
      /* the page shows the error; keep the typed name */
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        aria-label="New member name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Member name"
        disabled={isLoading}
      />
      <Button type="submit" disabled={isLoading || !name.trim()}>
        <UserPlus /> Add
      </Button>
    </form>
  );
}
