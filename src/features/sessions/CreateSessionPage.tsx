import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrCreateDefaultGroup } from '../groups/api';
import { getMembers, addMember } from '../members/api';
import { createSession } from './api';
import SessionForm from './components/SessionForm';

export default function CreateSessionPage() {
  const navigate = useNavigate();
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

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string;
      date: string;
      start_time: string;
      end_time: string;
      location: string;
      notes: string;
      participant_member_ids: string[];
    }) =>
      createSession({
        group_id: group!.id,
        ...data,
      }),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      navigate(`/sessions/${session.id}`);
    },
  });

  if (isLoading) {
    return <p className="text-sm text-gray-400 text-center py-12">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">New Session</h2>
      </div>

      {createMutation.isError && (
        <p className="text-sm text-danger bg-red-50 p-3 rounded-lg">
          Error: {(createMutation.error as Error).message}
        </p>
      )}

      <SessionForm
        members={members}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
        onCreateMember={async (name) => {
          const member = await addMember(group!.id, name);
          queryClient.invalidateQueries({ queryKey: ['members'] });
          return member;
        }}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
