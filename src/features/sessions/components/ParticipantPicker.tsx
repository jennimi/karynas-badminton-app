import { ClipboardPaste, Search, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../../../shared/lib/cn';
import type { Member } from '../../../shared/types';
import { Alert } from '../../../shared/ui/alert';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Textarea } from '../../../shared/ui/textarea';
import {
  dedupeNames,
  matchNames,
  parseNames,
  type NameMatchResult,
} from '../../../shared/utils/nameParser';

interface Props {
  members: Member[];
  selected: string[]; // member IDs
  onChange: (ids: string[]) => void;
  onCreateMember?: (name: string) => Promise<Member>;
}

type Decision =
  | { kind: 'use'; memberId: string }
  | { kind: 'create' }
  | { kind: 'skip' };

interface ReviewItem {
  result: NameMatchResult;
  decision: Decision;
}

export default function ParticipantPicker({
  members,
  selected,
  onChange,
  onCreateMember,
}: Props) {
  const [search, setSearch] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [text, setText] = useState('');
  const [review, setReview] = useState<ReviewItem[] | null>(null);
  const [repeated, setRepeated] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? members.filter((m) => m.name.toLowerCase().includes(q)) : members;
  }, [members, search]);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const checkNames = () => {
    // drop repeated names in the pasted text (and remember them for the alert)
    const { unique: names, repeated: dropped } = dedupeNames(parseNames(text));
    setRepeated([...new Set(dropped)]);
    if (names.length === 0) return;

    setReview(
      matchNames(names, members).map((result) => ({
        result,
        // Assume the best suggestion; the buttons below let you change it
        decision: result.match
          ? { kind: 'use', memberId: result.match.id }
          : result.suggestions.length > 0
            ? { kind: 'use', memberId: result.suggestions[0].id }
            : { kind: 'create' },
      }))
    );
  };

  const setDecision = (index: number, decision: Decision) =>
    setReview((r) => r && r.map((item, i) => (i === index ? { ...item, decision } : item)));

  const apply = async () => {
    if (!review) return;
    setApplying(true);
    const ids = new Set(selected);
    let created = 0;

    for (const { result, decision } of review) {
      if (decision.kind === 'skip') continue;
      if (decision.kind === 'use') {
        ids.add(decision.memberId);
      } else if (onCreateMember) {
        try {
          const member = await onCreateMember(result.name);
          ids.add(member.id);
          created++;
        } catch (e) {
          toast.error((e as Error).message);
        }
      }
    }

    const added = ids.size - selected.length;
    onChange([...ids]);
    setApplying(false);
    setReview(null);
    setText('');
    setShowPaste(false);
    toast.success(
      `Added ${added} ${added === 1 ? 'person' : 'people'}` +
        (created ? ` (${created} new member${created === 1 ? '' : 's'})` : '')
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-extrabold">Participants</h3>
          <Badge variant="brand">
            {selected.length} / {members.length}
          </Badge>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => onChange(members.map((m) => m.id))}>
            Select all
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>
            Clear
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search members"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members…"
          className="pl-9"
        />
      </div>

      <div className="max-h-72 overflow-y-auto rounded-2xl border border-border p-1.5">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {members.length === 0 ? 'No members yet — paste a list below to add some.' : 'No members found 🔍'}
          </p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {filtered.map((m) => {
              const on = selected.includes(m.id);
              return (
                <li key={m.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                      on ? 'bg-brand-soft text-brand-strong' : 'hover:bg-muted'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(m.id)}
                      className="size-4 cursor-pointer accent-brand"
                    />
                    <span className="truncate">{m.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Paste a list */}
      {!showPaste ? (
        <Button variant="secondary" size="sm" onClick={() => setShowPaste(true)}>
          <ClipboardPaste /> Add from a pasted list
        </Button>
      ) : (
        <div className="space-y-3 rounded-2xl border border-border bg-muted/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Paste names (one per line, numbers and bullets are fine)</p>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Close"
              onClick={() => {
                setShowPaste(false);
                setReview(null);
              }}
            >
              <X />
            </Button>
          </div>

          {!review ? (
            <>
              <Textarea
                aria-label="Pasted names"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder={'1. Karyna\n2. Gavin\n3. Alex'}
              />
              <Button size="sm" onClick={checkNames} disabled={!parseNames(text).length}>
                <Sparkles /> Check names
              </Button>
            </>
          ) : (
            <>
              {repeated.length > 0 && (
                <Alert>
                  <p>Listed more than once, counted once: {repeated.join(', ')}</p>
                </Alert>
              )}
              {review.some((r) => r.result.match && selected.includes(r.result.match.id)) && (
                <Alert tone="info">
                  <p>
                    Already in this session (no change):{' '}
                    {review
                      .filter((r) => r.result.match && selected.includes(r.result.match.id))
                      .map((r) => r.result.match!.name)
                      .join(', ')}
                  </p>
                </Alert>
              )}
              <ul className="space-y-2">
                {review.map(({ result, decision }, i) => (
                  <li key={result.name + i} className="rounded-xl bg-card p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold">{result.name}</span>

                      {result.match && (
                        <Badge variant={selected.includes(result.match.id) ? 'butter' : 'lime'}>
                          {selected.includes(result.match.id)
                            ? 'Already in this session'
                            : result.match.name !== result.name
                              ? `Existing member: ${result.match.name} ✓`
                              : 'Existing member ✓'}
                        </Badge>
                      )}

                      {!result.match && result.suggestions.length === 0 && (
                        <div className="flex items-center gap-2">
                          <Badge variant={decision?.kind === 'skip' ? 'neutral' : 'brand'}>
                            {decision?.kind === 'skip' ? 'Skipped' : 'New member'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDecision(i, decision?.kind === 'skip' ? { kind: 'create' } : { kind: 'skip' })
                            }
                          >
                            {decision?.kind === 'skip' ? 'Add' : 'Skip'}
                          </Button>
                        </div>
                      )}

                      {!result.match && result.suggestions.length > 0 && (
                        <Badge variant={decision.kind === 'skip' ? 'neutral' : decision.kind === 'create' ? 'brand' : 'butter'}>
                          {decision.kind === 'use'
                            ? `Assumed: ${members.find((m) => m.id === decision.memberId)?.name}`
                            : decision.kind === 'create'
                              ? 'New member'
                              : 'Skipped'}
                        </Badge>
                      )}
                    </div>

                    {!result.match && result.suggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {result.suggestions.map((s) => (
                          <Button
                            key={s.id}
                            size="sm"
                            variant={decision.kind === 'use' && decision.memberId === s.id ? 'primary' : 'outline'}
                            onClick={() => setDecision(i, { kind: 'use', memberId: s.id })}
                          >
                            Same as {s.name}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant={decision.kind === 'create' ? 'primary' : 'outline'}
                          onClick={() => setDecision(i, { kind: 'create' })}
                        >
                          New member
                        </Button>
                        <Button
                          size="sm"
                          variant={decision.kind === 'skip' ? 'primary' : 'ghost'}
                          onClick={() => setDecision(i, { kind: 'skip' })}
                        >
                          Skip
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={apply} disabled={applying}>
                  {applying ? 'Adding…' : 'Add to session'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReview(null)} disabled={applying}>
                  Back
                </Button>
                <span className="text-xs text-muted-foreground">
                  Suggested matches are picked for you. Change any you disagree with.
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
