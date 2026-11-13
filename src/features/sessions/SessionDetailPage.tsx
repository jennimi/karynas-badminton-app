import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Clock, MapPin, Pencil, Swords, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import { Avatar } from '../../shared/ui/avatar';
import { Badge } from '../../shared/ui/badge';
import { Button, buttonVariants } from '../../shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { Skeleton } from '../../shared/ui/skeleton';
import { formatDate, formatTimeRange, isUpcoming, relativeDay } from '../../shared/utils/format';
import { useCurrentGroup } from '../groups/hooks';
import { addMember, getMembers } from '../members/api';
import { deleteSession, getSession, updateSession } from './api';
import SessionForm from './components/SessionForm';

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: group } = useCurrentGroup();

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ['session', id],
    queryFn: () => getSession(id!),
    enabled: !!id,
  });
  const { data: members = [] } = useQuery({
    queryKey: ['members', group?.id],
    queryFn: () => getMembers(group!.id),
    enabled: !!group,
  });

  const refreshLists = () => {
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
    queryClient.invalidateQueries({ queryKey: ['upcomingSessions'] });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
  };

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateSession>[1]) => updateSession(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      refreshLists();
      toast.success('Session updated');
      setIsEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSession(id!),
    onSuccess: () => {
      refreshLists();
      toast.success('Session deleted');
      navigate('/sessions');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const back = (
    <Link
      to="/sessions"
      className="inline-flex items-center gap-1 rounded-md text-sm font-bold text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ChevronLeft className="size-4" /> Sessions
    </Link>
  );

  if (isLoading) return <Skeleton className="h-64" />;
  if (isError || !session) {
    return (
      <Card>
        <EmptyState
          emoji="🤷"
          title="Session not found"
          action={<Link to="/sessions" className={buttonVariants({ variant: 'outline' })}>Back to sessions</Link>}
        />
      </Card>
    );
  }

  if (isEditing) {
    return (
      <div className="space-y-6">
        {back}
        <PageHeader title="Edit session" />
        <SessionForm
          members={members}
          initialData={{
            ...session,
            participantIds: session.participants.map((p) => p.member_id),
          }}
          submitLabel="Save changes"
          isLoading={updateMutation.isPending}
          onCancel={() => setIsEditing(false)}
          onSubmit={async (data) => {
            await updateMutation.mutateAsync(data).catch(() => undefined);
          }}
          onCreateMember={async (name) => {
            const member = await addMember(group!.id, name);
            queryClient.invalidateQueries({ queryKey: ['members'] });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            return member;
          }}
        />
      </div>
    );
  }

  const upcoming = isUpcoming(session.date);
  const time = formatTimeRange(session.start_time, session.end_time);
  const people = [...session.participants].sort((a, b) =>
    a.member.name.localeCompare(b.member.name)
  );

  return (
    <div className="space-y-6">
      {back}

      <PageHeader
        title={session.title || formatDate(session.date, 'long')}
        description={session.title ? formatDate(session.date, 'long') : undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Pencil /> Edit
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={upcoming ? 'lime' : 'neutral'}>
              {upcoming ? relativeDay(session.date) : 'Finished'}
            </Badge>
            {time && (
              <Badge variant="butter">
                <Clock className="size-3.5" /> {time}
              </Badge>
            )}
            {session.location && (
              <Badge variant="brand">
                <MapPin className="size-3.5" /> {session.location}
              </Badge>
            )}
          </div>
          {session.notes && (
            <p className="rounded-2xl bg-muted/60 p-3 text-sm">{session.notes}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participants</CardTitle>
          <Badge variant="brand">{people.length}</Badge>
        </CardHeader>
        <CardContent>
          {people.length === 0 ? (
            <EmptyState
              emoji="👥"
              title="No participants yet"
              action={
                <Button size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil /> Add participants
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-border px-3 py-2"
                >
                  <Avatar name={p.member.name} className="size-8" />
                  <span className="truncate text-sm font-bold">{p.member.name}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Gavin: replace this placeholder with <MatchmakingTab sessionId={session.id} /> */}
      <div className="flex flex-col items-center gap-1 rounded-card border-2 border-dashed border-border p-6 text-center text-muted-foreground">
        <Swords className="size-6" />
        <p className="font-bold">Matchups will appear here</p>
        <p className="text-sm">Randomised teams and scores — coming soon.</p>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
        title="Delete this session?"
        description="The session and its participant list will be removed. Members themselves are not affected."
        confirmLabel="Delete session"
      />
    </div>
  );
}
