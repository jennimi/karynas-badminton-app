import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Crown,
  Pencil,
  Swords,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import { StatCard } from '../../shared/components/StatCard';
import { RallyLoader } from '../../shared/components/brand/RallyLoader';
import { cn } from '../../shared/lib/cn';
import { Avatar } from '../../shared/ui/avatar';
import { Badge } from '../../shared/ui/badge';
import { Button } from '../../shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { formatDate } from '../../shared/utils/format';
import { useSyncCurrentGroup } from '../groups/hooks';
import { useMe } from '../members/useMe';
import { useAdmin } from '../payments/useAdmin';
import { deleteTournament, getTournament } from './api';
import {
  formatPairName,
  getMultiTeamPlayerCounts,
  getPlayerIdentityKey,
  getRoundLabel,
  nextPowerOfTwo,
} from './bracket';
import { BracketMatchCard } from './components/BracketMatchCard';
import { EditTournamentPairDialog } from './components/EditTournamentPairDialog';
import { RecordScoreDialog } from './components/RecordScoreDialog';
import type {
  MatchPlayerConflict,
  TournamentMatch,
  TournamentParticipantWithMember,
  TournamentStatus,
} from './types';

const statusBadgeMap: Record<
  TournamentStatus,
  { label: string; variant: 'neutral' | 'butter' | 'lime' }
> = {
  draft: { label: 'Draft', variant: 'neutral' },
  in_progress: { label: 'In Progress', variant: 'butter' },
  completed: { label: 'Completed', variant: 'lime' },
};

export default function TournamentDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: tournament,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => getTournament(id),
    enabled: Boolean(id),
  });

  useSyncCurrentGroup(tournament?.group_id);
  const { memberId: myMemberId } = useMe(tournament?.group_id);
  const { isAdmin } = useAdmin(tournament?.group_id);

  const [selectedMatchState, setSelectedMatchState] = useState<{
    matchId: string;
    preselectedWinnerId?: string | null;
  } | null>(null);
  const [editPairState, setEditPairState] = useState<{
    participant: TournamentParticipantWithMember;
    opposingParticipant?: TournamentParticipantWithMember | null;
    conflict?: MatchPlayerConflict | null;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const participantById = useMemo(() => {
    const map = new Map<string, TournamentParticipantWithMember>();
    for (const p of tournament?.participants ?? []) {
      map.set(p.id, p);
    }
    return map;
  }, [tournament?.participants]);

  const multiTeamCounts = useMemo(
    () =>
      getMultiTeamPlayerCounts(
        (tournament?.participants ?? []).map((p) => ({
          player1Name: p.player1_name,
          player1MemberId: p.member_id,
          player2Name: p.player2_name,
          player2MemberId: p.partner_member_id,
        }))
      ),
    [tournament?.participants]
  );

  const rounds = useMemo(() => {
    if (!tournament) return [];
    const grouped = new Map<number, TournamentMatch[]>();
    for (const m of tournament.matches) {
      const list = grouped.get(m.round) ?? [];
      list.push(m);
      grouped.set(m.round, list);
    }
    const sortedRoundNums = Array.from(grouped.keys()).sort((a, b) => a - b);
    return sortedRoundNums.map((roundNum) => ({
      round: roundNum,
      label: getRoundLabel(roundNum, sortedRoundNums.length),
      matches: (grouped.get(roundNum) ?? []).sort(
        (a, b) => a.match_order - b.match_order
      ),
    }));
  }, [tournament]);

  const championPair = useMemo(() => {
    if (!tournament || rounds.length === 0) return null;
    const finalRound = rounds[rounds.length - 1];
    const finalMatch = finalRound.matches[0];
    if (!finalMatch?.winner_id) return null;
    return participantById.get(finalMatch.winner_id) ?? null;
  }, [tournament, rounds, participantById]);

  const playableMatchesStats = useMemo(() => {
    if (!tournament) return { completed: 0, total: 0 };
    const playable = tournament.matches.filter(
      (m) =>
        !(
          m.round === 1 &&
          ((m.participant1_id && !m.participant2_id) ||
            (!m.participant1_id && m.participant2_id))
        )
    );
    const completed = playable.filter((m) => m.winner_id !== null).length;
    return { completed, total: playable.length };
  }, [tournament]);

  const selectedMatch = useMemo(() => {
    if (!selectedMatchState || !tournament) return null;
    return (
      tournament.matches.find((m) => m.id === selectedMatchState.matchId) ?? null
    );
  }, [tournament, selectedMatchState]);

  const deleteMutation = useMutation({
    mutationFn: () => deleteTournament(id),
    onSuccess: () => {
      if (tournament?.group_id) {
        queryClient.invalidateQueries({
          queryKey: ['tournaments', tournament.group_id],
        });
      }
      if (tournament?.session_id) {
        queryClient.invalidateQueries({
          queryKey: ['sessionTournaments', tournament.session_id],
        });
      }
      toast.success('Tournament deleted.');
      navigate('/tournaments');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Could not delete tournament');
    },
  });

  function handleResolveConflict(
    match: TournamentMatch,
    conflict: MatchPlayerConflict
  ) {
    const p1 = match.participant1_id
      ? participantById.get(match.participant1_id)
      : null;
    const p2 = match.participant2_id
      ? participantById.get(match.participant2_id)
      : null;
    if (!p1 || !p2) return;
    setSelectedMatchState(null);
    setEditPairState({
      participant: p1,
      opposingParticipant: p2,
      conflict,
    });
  }

  if (isLoading) {
    return <RallyLoader />;
  }

  if (error || !tournament) {
    return (
      <Card>
        <EmptyState
          emoji="🤷"
          title="Tournament not found"
          description="This tournament may have been deleted or the link is invalid."
          action={
            <Link to="/tournaments">
              <Button variant="secondary">
                <ArrowLeft />
                Back to Tournaments
              </Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const statusMeta = statusBadgeMap[tournament.status] ?? statusBadgeMap.draft;
  const bracketSize = nextPowerOfTwo(Math.max(2, tournament.participants.length));
  const dateOnly = tournament.created_at.slice(0, 10);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/tournaments"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            All tournaments
          </Link>

          {tournament.session_id && (
            <Link
              to={`/sessions/${tournament.session_id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-extrabold text-brand-strong hover:bg-brand/25"
            >
              <Calendar className="size-3.5" />
              Back to Session
            </Link>
          )}
        </div>

        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-3">
              <span>{tournament.name}</span>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            </span>
          }
          description={`Created ${formatDate(dateOnly, 'long')} · ${bracketSize}-team Doubles Knockout`}
          actions={
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              title={isAdmin ? 'Admin mode unlocked' : 'Delete tournament'}
            >
              <Trash2 />
              Delete
            </Button>
          }
        />
      </div>

      {/* Celebratory Champion Pair Banner when Final is complete */}
      {championPair && (
        <Card className="border-border bg-lime-soft p-5 text-lime-strong shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-lime text-ink shadow-soft">
                <Trophy className="size-7" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="lime">Doubles Champions</Badge>
                  {championPair.seed !== null && (
                    <Badge variant="brand">Seed #{championPair.seed}</Badge>
                  )}
                </div>
                <h2 className="mt-1 text-2xl font-extrabold">
                  {formatPairName(championPair)}
                </h2>
                <p className="text-xs font-bold opacity-85">
                  Undefeated through {rounds.length} knockout round
                  {rounds.length === 1 ? '' : 's'}!
                </p>
              </div>
            </div>

            <div className="flex -space-x-2">
              <Avatar
                name={championPair.player1_name}
                emoji={championPair.member?.emoji}
                color={championPair.member?.color}
                className="size-12 text-base"
              />
              <Avatar
                name={championPair.player2_name}
                emoji={championPair.partner?.emoji}
                color={championPair.partner?.color}
                className="size-12 text-base"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Headline Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Doubles Pairs"
          value={tournament.participants.length}
          hint={`${bracketSize}-team bracket`}
          icon={Users}
          tone="brand"
        />
        <StatCard
          label="Matches Decided"
          value={`${playableMatchesStats.completed}/${playableMatchesStats.total}`}
          hint={
            playableMatchesStats.completed === playableMatchesStats.total &&
            playableMatchesStats.total > 0
              ? 'All matches finished'
              : 'Click Win on any pair or edit scores'
          }
          icon={Swords}
          tone="butter"
        />
        <StatCard
          label={championPair ? 'Champions' : 'Current Stage'}
          value={
            championPair
              ? formatPairName(championPair)
              : (rounds.find((r) => r.matches.some((m) => m.winner_id === null))
                  ?.label ?? 'In Progress')
          }
          hint={formatDate(dateOnly)}
          icon={championPair ? Crown : Calendar}
          tone={championPair ? 'lime' : 'coral'}
        />
      </div>

      {/* Interactive Knockout Bracket Tree */}
      <Card>
        <CardHeader>
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <CardTitle>Doubles Knockout Bracket</CardTitle>
            <span className="text-xs font-semibold text-muted-foreground">
              Click any match or &ldquo;Win&rdquo; button to pick the winner and optionally enter scores
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-3">
            <div className="flex min-w-max items-stretch gap-6">
              {rounds.map((roundCol, colIdx) => {
                const isFinalCol = colIdx === rounds.length - 1;
                return (
                  <div
                    key={roundCol.round}
                    className="flex w-72 shrink-0 flex-col"
                  >
                    <div className="mb-3 flex items-center justify-between rounded-xl bg-muted px-3 py-2">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-foreground">
                        {roundCol.label}
                      </span>
                      <Badge variant={isFinalCol ? 'lime' : 'neutral'}>
                        {roundCol.matches.length}{' '}
                        {roundCol.matches.length === 1 ? 'match' : 'matches'}
                      </Badge>
                    </div>

                    <div className="flex flex-1 flex-col justify-around gap-4 py-2">
                      {roundCol.matches.map((match) => (
                        <BracketMatchCard
                          key={match.id}
                          match={match}
                          participant1={
                            match.participant1_id
                              ? (participantById.get(match.participant1_id) ??
                                null)
                              : null
                          }
                          participant2={
                            match.participant2_id
                              ? (participantById.get(match.participant2_id) ??
                                null)
                              : null
                          }
                          myMemberId={myMemberId}
                          isFinal={isFinalCol}
                          onSelect={(m, preselectedWinnerId) =>
                            setSelectedMatchState({
                              matchId: m.id,
                              preselectedWinnerId,
                            })
                          }
                          onResolveConflict={handleResolveConflict}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seeded Doubles Pairs Roster */}
      <Card>
        <CardHeader>
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <CardTitle>
              Seeded Doubles Teams ({tournament.participants.length})
            </CardTitle>
            <span className="text-xs font-semibold text-muted-foreground">
              Need a mid-tournament sub? Click Edit on any team
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {tournament.participants.map((p) => {
              const isMe =
                Boolean(myMemberId) &&
                (p.member_id === myMemberId ||
                  p.partner_member_id === myMemberId);
              const isChampion = championPair?.id === p.id;
              const p1Guest = !p.member_id;
              const p2Guest = !p.partner_member_id;
              const p1Key = getPlayerIdentityKey(p.player1_name, p.member_id);
              const p2Key = getPlayerIdentityKey(p.player2_name, p.partner_member_id);
              const hasMultiTeam =
                (p1Key ? (multiTeamCounts.get(p1Key) ?? 0) >= 2 : false) ||
                (p2Key ? (multiTeamCounts.get(p2Key) ?? 0) >= 2 : false);

              return (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-2xl border p-3',
                    isMe
                      ? 'border-brand bg-brand-soft/40'
                      : isChampion
                        ? 'border-border bg-lime-soft/50'
                        : 'border-border bg-muted/30'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-extrabold text-brand-strong">
                      {p.seed ?? '—'}
                    </span>

                    <div className="flex -space-x-1.5 shrink-0">
                      <Avatar
                        name={p.player1_name}
                        emoji={p.member?.emoji}
                        color={p.member?.color}
                        compact
                        className="size-8 text-xs"
                      />
                      <Avatar
                        name={p.player2_name}
                        emoji={p.partner?.emoji}
                        color={p.partner?.color}
                        compact
                        className="size-8 text-xs"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">
                        {formatPairName(p)}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        {p1Guest && (
                          <Badge
                            variant="butter"
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {p.player1_name}: Guest
                          </Badge>
                        )}
                        {p2Guest && (
                          <Badge
                            variant="butter"
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {p.player2_name}: Guest
                          </Badge>
                        )}
                        {hasMultiTeam && (
                          <Badge
                            variant="butter"
                            className="px-1.5 py-0 text-[10px]"
                          >
                            2x Team
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {isMe && <Badge variant="brand">Your Team</Badge>}
                    {isChampion && (
                      <Badge variant="lime">
                        <Trophy className="size-3" />
                        Champs
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setEditPairState({ participant: p })}
                      aria-label={`Edit ${formatPairName(p)}`}
                      title="Edit or swap players"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Winner & Score Modal */}
      {selectedMatch && (
        <RecordScoreDialog
          open={Boolean(selectedMatch)}
          onClose={() => setSelectedMatchState(null)}
          tournamentId={tournament.id}
          groupId={tournament.group_id}
          match={selectedMatch}
          participant1={
            selectedMatch.participant1_id
              ? (participantById.get(selectedMatch.participant1_id) ?? null)
              : null
          }
          participant2={
            selectedMatch.participant2_id
              ? (participantById.get(selectedMatch.participant2_id) ?? null)
              : null
          }
          initialWinnerId={selectedMatchState?.preselectedWinnerId}
          onResolveConflict={handleResolveConflict}
        />
      )}

      {/* Mid-Tournament Pair Edit / Conflict Substitution Modal */}
      {editPairState && (
        <EditTournamentPairDialog
          open={Boolean(editPairState)}
          onClose={() => setEditPairState(null)}
          tournamentId={tournament.id}
          groupId={tournament.group_id}
          sessionId={tournament.session_id}
          participant={editPairState.participant}
          opposingParticipant={editPairState.opposingParticipant}
          conflict={editPairState.conflict}
          allParticipants={tournament.participants}
        />
      )}

      {/* Delete Tournament Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title={`Delete "${tournament.name}"?`}
        description="This will permanently delete the tournament, its doubles teams, and all recorded bracket matches."
        confirmLabel="Delete tournament"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
