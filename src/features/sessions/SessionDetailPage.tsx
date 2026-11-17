import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  MapPin,
  Pencil,
  Shuffle,
  Swords,
  Trash2,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { RallyLoader } from '../../shared/components/brand/RallyLoader';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import { StatCard } from '../../shared/components/StatCard';
import { cn } from '../../shared/lib/cn';
import { Badge } from '../../shared/ui/badge';
import { Button, buttonVariants } from '../../shared/ui/button';
import { Card } from '../../shared/ui/card';
import { Tabs } from '../../shared/ui/tabs';
import { formatCourts, formatDate, formatTimeRange, isUpcoming, relativeDay } from '../../shared/utils/format';
import { useCurrentGroup, useSyncCurrentGroup } from '../groups/hooks';
import { addMember, getMembers } from '../members/api';
import { deleteSession, getSession, updateSession } from './api';
import SessionForm from './components/SessionForm';
import { ActivityFeed } from '../activity/ActivityFeed';
import { SessionStandings } from '../stats/components/SessionStandings';
import { getMatches } from '../matchmaking/api';
import { ShufflePairsModal } from '../matchmaking/components/ShufflePairsModal';
import MatchmakingTab from '../matchmaking/MatchmakingTab';
import { useAdmin } from '../payments/useAdmin';
import { PaymentPanel } from '../payments/components/PaymentPanel';
import { getSessionTournaments } from '../tournaments/api';
import { formatPairName } from '../tournaments/bracket';
import { CreateTournamentDialog } from '../tournaments/components/CreateTournamentDialog';
import type { DraftDoublesPair } from '../tournaments/types';

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [shuffleOpen, setShuffleOpen] = useState(false);
  const [tournamentDraftPairs, setTournamentDraftPairs] = useState<
    DraftDoublesPair[] | null
  >(null);
  const [params] = useSearchParams();
  // a shared link (/s/…) opens on Payments: ?tab=payments
  const linkedTab = params.get('tab') === 'payments' ? 'payments' : params.get('tab') === 'matches' ? 'matches' : null;
  const [tab, setTab] = useState<'matches' | 'payments' | null>(linkedTab);
  const { data: group } = useCurrentGroup();

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ['session', id],
    queryFn: () => getSession(id!),
    enabled: !!id,
  });
  // opening a session (e.g. from the dashboard) switches to its group
  useSyncCurrentGroup(session?.group_id);
  const admin = useAdmin(session?.group_id);
  // only for the count in the overview (the Matches card uses the same query)
  const { data: matches } = useQuery({
    queryKey: ['matches', id],
    queryFn: () => getMatches(id!),
    enabled: !!id,
    retry: false,
  });
  const { data: members = [] } = useQuery({
    queryKey: ['members', group?.id],
    queryFn: () => getMembers(group!.id),
    enabled: !!group,
  });
  const { data: sessionTournaments = [] } = useQuery({
    queryKey: ['sessionTournaments', id],
    queryFn: () => getSessionTournaments(id!),
    enabled: !!id,
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
    mutationFn: () => deleteSession(id!, admin.code!),
    onSuccess: () => {
      refreshLists();
      toast.success('Session deleted');
      navigate('/sessions');
    },
    onError: (e: Error) => {
      if (/passcode|only the admin/i.test(e.message)) admin.lock();
      toast.error(e.message);
    },
  });

  const back = (
    <Link
      to="/sessions"
      className="inline-flex items-center gap-1 rounded-md text-sm font-bold text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ChevronLeft className="size-4" /> Sessions
    </Link>
  );

  if (isLoading) return <RallyLoader message="Loading the session…" />;
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
  const n = session.participants.length;
  const approved = session.participants.filter((p) => p.payment_status === 'approved').length;
  const waiting = session.participants.filter((p) => p.payment_status === 'pending').length;
  const costSet = session.total_cost != null;
  // On a phone the two panels are tabs. After the game people come to pay, so open on Payments;
  // before / during the game open on Matches. On a desktop both are side by side.
  const activeTab = tab ?? (upcoming ? 'matches' : 'payments');
  const perCourt = session.courts && n > 0 ? (n / session.courts).toFixed(1).replace(/\.0$/, '') : null;

  return (
    <div className="space-y-5">
      {back}

      <PageHeader
        title={session.title || formatDate(session.date, 'long')}
        description={session.title ? formatDate(session.date, 'long') : undefined}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShuffleOpen(true)}>
              <Shuffle /> Shuffle Pairs
            </Button>
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Pencil /> Edit
            </Button>
            {/* deleting is admin only (and the database refuses it for anyone else) */}
            {admin.isAdmin && (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={upcoming ? 'lime' : 'neutral'}>{upcoming ? relativeDay(session.date) : 'Finished'}</Badge>
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
      {session.notes && <p className="rounded-2xl bg-muted/60 p-3 text-sm">{session.notes}</p>}

      {sessionTournaments.length > 0 && (
        <section aria-label="Session tournaments" className="space-y-2.5">
          {sessionTournaments.map((t) => {
            const isDone = t.status === 'completed';
            return (
              <Card
                key={t.id}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-3 p-4',
                  isDone
                    ? 'border-border bg-lime-soft/50'
                    : 'border-brand bg-brand-soft/45'
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-soft',
                      isDone ? 'bg-lime text-ink' : 'bg-brand text-ink'
                    )}
                  >
                    <Trophy className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-extrabold">
                        {t.name}
                      </span>
                      <Badge variant={isDone ? 'lime' : 'butter'}>
                        {isDone ? 'Completed' : 'Active Tournament'}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {t.participant_count} pairs · {t.completed_match_count}/
                      {t.match_count} matches decided
                      {t.champion_pair
                        ? ` · Champions: ${formatPairName(t.champion_pair)}`
                        : ''}
                    </p>
                  </div>
                </div>

                <Link
                  to={`/tournaments/${t.id}`}
                  className={buttonVariants({
                    variant: isDone ? 'lime' : 'primary',
                    size: 'sm',
                  })}
                >
                  Open Bracket
                  <ChevronRight className="size-4" />
                </Link>
              </Card>
            );
          })}
        </section>
      )}

      <section aria-label="Session overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Players"
          value={n}
          hint={perCourt ? `${perCourt} per court` : undefined}
          icon={Users}
          tone="brand"
        />
        <StatCard
          label="Courts"
          value={session.courts ?? '—'}
          hint={session.courts ? formatCourts(session.courts) + ' booked' : 'not set'}
          icon={LayoutGrid}
          tone="coral"
        />
        <StatCard
          label="Paid"
          value={costSet && n > 0 ? `${approved}/${n}` : '—'}
          hint={!costSet ? 'cost not set' : waiting > 0 ? `${waiting} waiting` : 'approved'}
          icon={Wallet}
          tone="lime"
        />
        <StatCard
          label="Matches"
          value={matches ? matches.length : '—'}
          hint={matches && matches.length > 0 ? 'played' : 'none yet'}
          icon={Swords}
          tone="butter"
        />
      </section>

      {/* phone: switch between the two panels (so neither is buried at the bottom) */}
      <div className="lg:hidden">
        <Tabs<'matches' | 'payments'>
          label="Session sections"
          value={activeTab}
          onChange={setTab}
          options={[
            { value: 'matches', label: 'Matches', count: matches?.length },
            { value: 'payments', label: 'Payments', count: n },
          ]}
        />
      </div>

      {/* desktop: matches (main) next to payments */}
      <div className="grid items-start gap-6 lg:grid-cols-5">
        <div className={cn(activeTab === 'matches' ? 'block' : 'hidden', 'min-w-0 lg:col-span-3 lg:block')}>
          <div className="space-y-6">
            <MatchmakingTab
            session={session}
            onOpenShuffle={() => setShuffleOpen(true)}
          />
            <SessionStandings sessionId={session.id} sessionDate={session.date} groupId={session.group_id} />
          </div>
        </div>
        <div className={cn(activeTab === 'payments' ? 'block' : 'hidden', 'min-w-0 lg:col-span-2 lg:block')}>
          <PaymentPanel session={session} onAddParticipants={() => setIsEditing(true)} />
        </div>
      </div>

      {shuffleOpen && (
        <ShufflePairsModal
          open={shuffleOpen}
          onClose={() => setShuffleOpen(false)}
          session={session}
          members={members}
          onCustomizeTournament={(pairs) => setTournamentDraftPairs(pairs)}
        />
      )}

      {tournamentDraftPairs !== null && (
        <CreateTournamentDialog
          open={tournamentDraftPairs !== null}
          onClose={() => setTournamentDraftPairs(null)}
          groupId={session.group_id}
          sessionId={session.id}
          initialName={`${session.title?.trim() || formatDate(session.date, 'short')} Tournament`}
          initialPairs={tournamentDraftPairs}
        />
      )}

      <Card>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
          className="flex w-full items-center justify-between rounded-card p-4 text-left text-sm font-extrabold focus-visible:outline-2 focus-visible:outline-ring"
        >
          History of this session
          <ChevronDown className={cn('size-4 transition-transform', showHistory && 'rotate-180')} />
        </button>
        {showHistory && (
          <div className="border-t border-border px-4 pb-4">
            <ActivityFeed groupId={session.group_id} sessionId={session.id} compact loadMore pageSize={30} />
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
        title="Delete this session?"
        description="The session, its participants, payments and matches will be removed. Members themselves are not affected."
        confirmLabel="Delete session"
      />
    </div>
  );
}
