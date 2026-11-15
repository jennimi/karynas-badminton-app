import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { RallyLoader } from '../../shared/components/brand/RallyLoader';
import { PageHeader } from '../../shared/components/PageHeader';
import type { CreateSessionInput } from '../../shared/types';
import { useCurrentGroup } from '../groups/hooks';
import { addMember, getMembers } from '../members/api';
import { createSession } from './api';
import SessionForm from './components/SessionForm';

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: group } = useCurrentGroup();

  // The Courts page links here with the slot that was picked: /sessions/new?date=…&start=…&end=…&location=…&courts=…
  // Nothing is saved until the form is submitted, so it can still be changed.
  const [params] = useSearchParams();
  const time = (v: string | null) => (v && /^\d{2}:\d{2}$/.test(v) ? v : null);
  const date = params.get('date');
  const prefill = {
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    start_time: time(params.get('start')),
    end_time: time(params.get('end')),
    location: params.get('location'),
    courts: Number(params.get('courts')) || null,
    notes: params.get('notes'),
  };

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', group?.id],
    queryFn: () => getMembers(group!.id),
    enabled: !!group,
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<CreateSessionInput, 'group_id'>) =>
      createSession({ group_id: group!.id, ...data }),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingSessions'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Session created 🎉');
      navigate(`/sessions/${session.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Link
        to="/sessions"
        className="inline-flex items-center gap-1 rounded-md text-sm font-bold text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ChevronLeft className="size-4" /> Sessions
      </Link>
      <PageHeader title="New session" description="Set the details and choose who’s playing." />

      {isLoading || !group ? (
        <RallyLoader message="Getting the form ready…" />
      ) : (
        <SessionForm
          members={members}
          initialData={prefill}
          isLoading={createMutation.isPending}
          onCancel={() => navigate(-1)}
          onSubmit={async (data) => {
            await createMutation.mutateAsync(data).catch(() => undefined);
          }}
          onCreateMember={async (name) => {
            const member = await addMember(group.id, name);
            queryClient.invalidateQueries({ queryKey: ['members'] });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            return member;
          }}
        />
      )}
    </div>
  );
}
