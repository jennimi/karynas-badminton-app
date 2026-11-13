import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrCreateDefaultGroup } from '../groups/api';
import { getMembers, addMember, addMembersInBulk, deleteMember, updateMemberName } from './api';
import AddMemberForm from './components/AddMemberForm';
import BulkAddMembers from './components/BulkAddMembers';
import MemberList from './components/MemberList';

export default function MembersPage() {
  const queryClient = useQueryClient();

  const { data: group } = useQuery({
    queryKey: ['defaultGroup'],
    queryFn: getOrCreateDefaultGroup,
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', group?.id],
    queryFn: () => getMembers(group!.id),
    enabled: !!group,
  });

  const addMutation = useMutation({
    mutationFn: (name: string) => addMember(group!.id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });

  const bulkMutation = useMutation({
    mutationFn: (names: string[]) => addMembersInBulk(group!.id, names),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateMemberName(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });

  if (isLoading) {
    return <p className="text-sm text-gray-400 text-center py-12">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Members</h2>

      <div className="space-y-4">
        <AddMemberForm
          onAdd={async (name) => {
            await addMutation.mutateAsync(name);
          }}
          isLoading={addMutation.isPending}
        />

        {addMutation.isError && (
          <p className="text-sm text-danger">
            {(addMutation.error as Error).message}
          </p>
        )}

        <BulkAddMembers
          onBulkAdd={async (names) => {
            const result = await bulkMutation.mutateAsync(names);
            return {
              added: result.added.length,
              skipped: result.skipped,
            };
          }}
          isLoading={bulkMutation.isPending}
        />
      </div>

      <MemberList
        members={members}
        onDelete={(id) => deleteMutation.mutate(id)}
        onRename={(id, name) => renameMutation.mutate({ id, name })}
      />
    </div>
  );
}
