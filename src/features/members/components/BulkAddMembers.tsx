import { ClipboardPaste } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../../../shared/lib/cn';
import type { Member } from '../../../shared/types';
import { Button } from '../../../shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card';
import { Textarea } from '../../../shared/ui/textarea';
import { matchNames, parseNames } from '../../../shared/utils/nameParser';

interface Props {
  existing: Member[];
  onBulkAdd: (names: string[]) => Promise<{ added: number; skipped: string[] }>;
  isLoading: boolean;
}

export default function BulkAddMembers({ existing, onBulkAdd, isLoading }: Props) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);

  // classify each pasted name as new or already a member
  const preview = useMemo(() => {
    const seen = new Set<string>();
    const names = parseNames(text).filter((n) => {
      const k = n.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return matchNames(names, existing).map((r) => ({ name: r.name, isNew: !r.match }));
  }, [text, existing]);

  const newNames = preview.filter((p) => p.isNew).map((p) => p.name);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <ClipboardPaste /> Add many from a list
      </Button>
    );
  }

  const submit = async () => {
    const res = await onBulkAdd(newNames);
    if (res.added) toast.success(`Added ${res.added} member${res.added === 1 ? '' : 's'} 🎉`);
    if (res.skipped.length) toast.error(`Couldn’t add: ${res.skipped.join(', ')}`);
    setText('');
  };

  return (
    <Card className="bg-muted/40">
      <CardHeader>
        <CardTitle>Paste a list of names</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          aria-label="Names to add"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={'1. Karyna\n2. Gavin ✅\n- Alex\nor: Mia, Budi, Nina'}
          disabled={isLoading}
        />

        {preview.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Preview">
            {preview.map((p) => (
              <span
                key={p.name}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-bold',
                  p.isNew ? 'bg-lime-soft text-lime-strong' : 'bg-muted text-muted-foreground line-through'
                )}
                title={p.isNew ? 'Will be added' : 'Already a member'}
              >
                {p.name}
              </span>
            ))}
          </div>
        )}
        {preview.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {newNames.length} new · {preview.length - newNames.length} already members (skipped)
          </p>
        )}

        <Button onClick={submit} disabled={isLoading || newNames.length === 0}>
          {isLoading ? 'Adding…' : `Add ${newNames.length} member${newNames.length === 1 ? '' : 's'}`}
        </Button>
      </CardContent>
    </Card>
  );
}
