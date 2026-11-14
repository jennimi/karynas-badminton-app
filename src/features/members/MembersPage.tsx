import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Search, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import type { Member } from '../../shared/types';
import { Badge } from '../../shared/ui/badge';
import { Button } from '../../shared/ui/button';
import { cn } from '../../shared/lib/cn';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { Input } from '../../shared/ui/input';
import { Skeleton } from '../../shared/ui/skeleton';
import { useCurrentGroup } from '../groups/hooks';
import { useAdmin } from '../payments/useAdmin';
import { addMember, addMembersInBulk, deleteMember, getMembers, updateMemberName } from './api';
import AddMemberForm from './components/AddMemberForm';
import BulkAddMembers from './components/BulkAddMembers';
import MemberList from './components/MemberList';
import { SortControl, type SortDir } from '../../shared/components/SortControl';
import { memberTypeInfo, sortMembers, useMemberTypes, type MemberSort, type MemberType } from './memberType';

export default function MembersPage() {
  const queryClient = useQueryClient();
  const { data: group } = useCurrentGroup();
  const admin = useAdmin(group?.id);
  const [query, setQuery] = useState('');
  const [toRemove, setToRemove] = useState<Member | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [typeFilter, setTypeFilter] = useState<MemberType | 'all'>('all');
  const [sortKey, setSortKey] = useState<MemberSort>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', group?.id],
    queryFn: () => getMembers(group!.id),
    enabled: !!group,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['members'] });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
  };

  const addMutation = useMutation({
    mutationFn: (name: string) => addMember(group!.id, name),
    onSuccess: (m) => {
      refresh();
      toast.success(`${m.name} added 🎉`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkMutation = useMutation({
    mutationFn: (names: string[]) => addMembersInBulk(group!.id, names),
    onSuccess: refresh,
  });

  const deleteMutation = useMutation({
    mutationFn: (m: Member) => deleteMember(m.id, admin.code!),
    onSuccess: () => {
      refresh();
      toast.success('Member removed');
      setToRemove(null);
    },
    onError: (e: Error) => {
      if (/passcode|only the admin/i.test(e.message)) admin.lock();
      toast.error(e.message);
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateMemberName(id, name, group!.id),
    onSuccess: () => {
      refresh();
      toast.success('Name updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const types = useMemberTypes(group?.id, members);
  const typeCounts = [...types.values()].reduce(
    (acc, t) => ({ ...acc, [t.type]: (acc[t.type] ?? 0) + 1 }),
    {} as Partial<Record<MemberType, number>>
  );
  const filtered = sortMembers(
    members.filter(
      (m) =>
        m.name.toLowerCase().includes(query.trim().toLowerCase()) &&
        (typeFilter === 'all' || types.get(m.id)?.type === typeFilter)
    ),
    types,
    sortKey,
    sortDir
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description="Everyone who plays with your group."
        actions={
          <>
            <Badge variant="brand" className="self-center px-3 py-1 text-sm">
              {members.length} members
            </Badge>
            <Button
              variant={showAdd ? 'outline' : 'primary'}
              aria-expanded={showAdd}
              onClick={() => setShowAdd((v) => !v)}
            >
              {showAdd ? (
                <>
                  <X /> Close
                </>
              ) : (
                <>
                  <UserPlus /> Add members
                </>
              )}
            </Button>
          </>
        }
      />

      {showAdd && (
        <Card>
          <CardContent className="space-y-4">
            <h2 className="font-extrabold">Add members</h2>
            <AddMemberForm
              existing={members}
              isLoading={addMutation.isPending}
              onAdd={async (name) => {
                await addMutation.mutateAsync(name);
              }}
            />
            <BulkAddMembers
              existing={members}
              isLoading={bulkMutation.isPending}
              onBulkAdd={async (names) => {
                const r = await bulkMutation.mutateAsync(names);
                return { added: r.added.length, skipped: r.skipped };
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All members</CardTitle>
          <span className="text-sm font-semibold text-muted-foreground">
            {filtered.length === members.length ? `${members.length} people` : `${filtered.length} of ${members.length}`}
          </span>
        </CardHeader>

        <div className="space-y-3 px-5 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search members"
                placeholder="Search members…"
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <SortControl
              options={[
                { value: 'name', label: 'Name' },
                { value: 'sessions', label: 'Sessions joined' },
                { value: 'status', label: 'Status' },
              ]}
              value={sortKey}
              dir={sortDir}
              onChange={(k) => {
                setSortKey(k);
                setSortDir(k === 'sessions' ? 'desc' : 'asc');
              }}
              onToggleDir={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            />
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by member type">
            {(['all', ...Object.keys(memberTypeInfo)] as (MemberType | 'all')[]).map((t) => {
              const count = t === 'all' ? members.length : (typeCounts[t] ?? 0);
              const active = typeFilter === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTypeFilter(t)}
                  title={t === 'all' ? undefined : memberTypeInfo[t].blurb}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    active ? 'bg-brand text-ink' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t === 'all' ? 'All' : memberTypeInfo[t].label} · {count}
                </button>
              );
            })}
          </div>

          <details className="group rounded-2xl bg-muted/40 px-3 py-2 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-bold text-brand-strong">
              <Info className="size-3.5" /> What do the labels mean?
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">
              Worked out automatically from attendance. Checked in this order; the first one that fits is used.
            </p>
            <ol className="mt-2 space-y-2">
              {(Object.keys(memberTypeInfo) as MemberType[]).map((t, i) => (
                <li key={t} className="grid grid-cols-[1rem_5.5rem_1fr] items-start gap-2">
                  <span className="pt-0.5 text-xs font-extrabold text-muted-foreground">{i + 1}</span>
                  <Badge variant={memberTypeInfo[t].variant} className="justify-center">
                    {memberTypeInfo[t].label}
                  </Badge>
                  <span className="text-xs">{memberTypeInfo[t].blurb}</span>
                </li>
              ))}
            </ol>
          </details>
        </div>
        <CardContent className="px-3 pb-3 pt-2">
          {isLoading || !group ? (
            <Skeleton className="h-40" />
          ) : members.length === 0 ? (
            <EmptyState emoji="👥" title="No members yet" description="Use “Add members” at the top to add the first one." />
          ) : filtered.length === 0 ? (
            <EmptyState
              emoji="🔍"
              title={query.trim() ? `No one matches “${query}”` : 'No members of this type'}
            />
          ) : (
            <MemberList
              members={filtered}
              types={types}
              onDelete={admin.isAdmin ? setToRemove : undefined}
              onRename={(id, name) => renameMutation.mutate({ id, name })}
            />
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={() => toRemove && deleteMutation.mutate(toRemove)}
        isLoading={deleteMutation.isPending}
        title={`Remove ${toRemove?.name ?? 'member'}?`}
        description="They’ll also be taken off every session they’re listed in."
        confirmLabel="Remove"
      />
    </div>
  );
}
