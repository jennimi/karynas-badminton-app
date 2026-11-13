import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import type { Member } from '../../shared/types';
import { Badge } from '../../shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { Input } from '../../shared/ui/input';
import { Skeleton } from '../../shared/ui/skeleton';
import { useCurrentGroup } from '../groups/hooks';
import { addMember, addMembersInBulk, deleteMember, getMembers, updateMemberName } from './api';
import AddMemberForm from './components/AddMemberForm';
import BulkAddMembers from './components/BulkAddMembers';
import MemberList from './components/MemberList';

export default function MembersPage() {
  const queryClient = useQueryClient();
  const { data: group } = useCurrentGroup();
  const [query, setQuery] = useState('');
  const [toRemove, setToRemove] = useState<Member | null>(null);

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
    mutationFn: (m: Member) => deleteMember(m.id),
    onSuccess: () => {
      refresh();
      toast.success('Member removed');
      setToRemove(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateMemberName(id, name),
    onSuccess: () => {
      refresh();
      toast.success('Name updated');
    },
    onError: (e: Error) =>
      toast.error(e.message.includes('duplicate') ? 'That name already exists in this group' : e.message),
  });

  const filtered = members.filter((m) =>
    m.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description="Everyone who plays with your group."
        actions={<Badge variant="brand" className="self-center px-3 py-1 text-sm">{members.length} members</Badge>}
      />

      <Card>
        <CardContent className="space-y-4">
          <h2 className="font-extrabold">Add a member</h2>
          <AddMemberForm
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

      <Card>
        <CardHeader className="flex-wrap">
          <CardTitle>All members</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search members"
              placeholder="Search members…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-2">
          {isLoading || !group ? (
            <Skeleton className="h-40" />
          ) : members.length === 0 ? (
            <EmptyState emoji="👥" title="No members yet" description="Add your first member above." />
          ) : filtered.length === 0 ? (
            <EmptyState emoji="🔍" title={`No one matches “${query}”`} />
          ) : (
            <MemberList
              members={filtered}
              onDelete={setToRemove}
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
