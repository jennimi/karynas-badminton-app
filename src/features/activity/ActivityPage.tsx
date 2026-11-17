import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../shared/components/PageHeader';
import { cn } from '../../shared/lib/cn';
import { Card, CardContent } from '../../shared/ui/card';
import { Skeleton } from '../../shared/ui/skeleton';
import { useCurrentGroup } from '../groups/hooks';
import { getMembers } from '../members/api';
import { useMe } from '../members/useMe';
import type { ActivityEntity } from './api';
import { ActivityFeed } from './ActivityFeed';

const KINDS: { key: string; label: string; entities?: ActivityEntity[] }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'payments', label: 'Payments', entities: ['payment'] },
  { key: 'sessions', label: 'Sessions', entities: ['session', 'participant', 'match'] },
  { key: 'members', label: 'Members', entities: ['member'] },
  { key: 'tournaments', label: 'Tournaments', entities: ['tournament'] },
  { key: 'other', label: 'Other', entities: ['venue', 'setting'] },
];

/** Everything that was changed in the group, and who did it. */
export default function ActivityPage() {
  const { data: group } = useCurrentGroup();
  const me = useMe(group?.id);
  const [params] = useSearchParams();
  const [kind, setKind] = useState(params.get('type') ?? 'all');
  const [who, setWho] = useState('anyone');
  const { data: members = [] } = useQuery({
    queryKey: ['members', group?.id],
    queryFn: () => getMembers(group!.id),
    enabled: !!group,
  });
  const active = KINDS.find((k) => k.key === kind) ?? KINDS[0];

  return (
    <div className="space-y-5">
      <PageHeader title="Activity" description="Everything that was changed here, and who did it." />

      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            aria-pressed={kind === k.key}
            onClick={() => setKind(k.key)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              kind === k.key ? 'bg-brand text-ink' : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {k.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs font-bold text-muted-foreground">
          Done by
          <select
            value={who}
            onChange={(e) => setWho(e.target.value)}
            className="h-9 rounded-control border border-border bg-card px-2.5 text-sm font-bold text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="anyone">Anyone</option>
            {me.memberId && <option value={me.memberId}>Me</option>}
            <option value="none">Someone (no name picked)</option>
            {members
              .filter((m) => m.id !== me.memberId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      <Card>
        <CardContent>
          {!group ? (
            <Skeleton className="h-40" />
          ) : (
            <ActivityFeed
              key={`${kind}-${who}`}
              groupId={group.id}
              entities={active.entities}
              actorId={who === 'anyone' ? undefined : who}
              loadMore
            />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        There are no accounts yet, so “who” is the member picked under “Who are you?”. If nobody was picked, or
        the change was made in the database directly, it shows as “Someone”. Entries can’t be edited or removed here.
      </p>
    </div>
  );
}
