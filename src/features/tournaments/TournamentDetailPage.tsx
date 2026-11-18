import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Crown,
  Medal,
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
import { Tabs } from '../../shared/ui/tabs';
import { formatDate } from '../../shared/utils/format';
import { useSyncCurrentGroup } from '../groups/hooks';
import { useMe } from '../members/useMe';
import { useAdmin } from '../payments/useAdmin';
import { deleteTournament, getTournament } from './api';
import {
  computeTournamentStandings,
  formatPairName,
  getBracketRoundLabel,
  getLoserDestinationLabel,
  getMultiTeamPlayerCounts,
  getPlayableMatches,
  getPlayerIdentityKey,
  isResetMatchActive,
  nextPowerOfTwo,
} from './bracket';
import { BracketMatchCard } from './components/BracketMatchCard';
import { EditTournamentPairDialog } from './components/EditTournamentPairDialog';
import { RecordScoreDialog } from './components/RecordScoreDialog';
import type {
  BracketType,
  MatchPlayerConflict,
  TournamentMatch,
  TournamentParticipantWithMember,
  TournamentStatus,
} from './types';

type BracketViewTab = 'all' | 'winner' | 'loser' | 'grand_final';

interface RoundColumn {
  key: string;
  round: number;
  bracketType: BracketType;
  label: string;
  matches: TournamentMatch[];
}

function groupRoundsByBracket(
  matches: TournamentMatch[],
  bracketTypes: BracketType[],
  format: 'single_elimination' | 'double_elimination'
): RoundColumn[] {
  const filtered = matches.filter((m) => bracketTypes.includes(m.bracket_type));
  if (filtered.length === 0) return [];

  const grouped = new Map<string, { bracketType: BracketType; round: number; matches: TournamentMatch[] }>();
  for (const m of filtered) {
    const key = `${m.bracket_type}:${m.round}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.matches.push(m);
    } else {
      grouped.set(key, { bracketType: m.bracket_type, round: m.round, matches: [m] });
    }
  }

  const orderedEntries = Array.from(grouped.entries()).sort(([, a], [, b]) => {
    const typeWeight = (t: BracketType) =>
      t === 'winner' ? 1 : t === 'loser' ? 2 : t === 'grand_final' ? 3 : 4;
    if (typeWeight(a.bracketType) !== typeWeight(b.bracketType)) {
      return typeWeight(a.bracketType) - typeWeight(b.bracketType);
    }
    return a.round - b.round;
  });

  const totalRoundsForType = new Map<BracketType, number>();
  for (const [, entry] of orderedEntries) {
    totalRoundsForType.set(
      entry.bracketType,
      Math.max(totalRoundsForType.get(entry.bracketType) ?? 0, entry.round)
    );
  }

  return orderedEntries.map(([key, entry]) => ({
    key,
    round: entry.round,
    bracketType: entry.bracketType,
    label: getBracketRoundLabel(
      entry.bracketType,
      entry.round,
      totalRoundsForType.get(entry.bracketType) ?? entry.round,
      format
    ),
    matches: entry.matches.sort((a, b) => a.match_order - b.match_order),
  }));
}

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
  const [bracketTab, setBracketTab] = useState<BracketViewTab>('all');

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

  const isDoubleElimination = tournament?.format === 'double_elimination';

  const winnerRounds = useMemo(() => {
    if (!tournament) return [];
    return groupRoundsByBracket(tournament.matches, ['winner'], tournament.format);
  }, [tournament]);

  const loserRounds = useMemo(() => {
    if (!tournament || !isDoubleElimination) return [];
    return groupRoundsByBracket(tournament.matches, ['loser'], tournament.format);
  }, [tournament, isDoubleElimination]);

  const grandFinalRounds = useMemo(() => {
    if (!tournament || !isDoubleElimination) return [];
    return groupRoundsByBracket(
      tournament.matches,
      ['grand_final', 'grand_final_reset'],
      tournament.format
    );
  }, [tournament, isDoubleElimination]);

  const standings = useMemo(() => {
    if (!tournament) {
      return { first: null, second: null, third: null, fourth: null };
    }
    return computeTournamentStandings(
      tournament.matches,
      tournament.participants,
      tournament.format
    );
  }, [tournament]);

  const championPair = standings.first;

  const playableMatchesStats = useMemo(() => {
    if (!tournament) {
      return {
        completed: 0,
        total: 0,
        winnerTotal: 0,
        loserTotal: 0,
        grandFinalTotal: 0,
      };
    }
    const playable = getPlayableMatches(tournament.matches);
    const completed = playable.filter((m) => m.winner_id !== null).length;
    return {
      completed,
      total: playable.length,
      winnerTotal: playable.filter((m) => m.bracket_type === 'winner').length,
      loserTotal: playable.filter((m) => m.bracket_type === 'loser').length,
      grandFinalTotal: playable.filter(
        (m) =>
          m.bracket_type === 'grand_final' ||
          m.bracket_type === 'grand_final_reset'
      ).length,
    };
  }, [tournament]);

  const currentStageLabel = useMemo(() => {
    if (!tournament) return 'In Progress';
    const allColumns = [...winnerRounds, ...loserRounds, ...grandFinalRounds];
    for (const col of allColumns) {
      const hasOpenMatch = col.matches.some((m) => {
        if (m.bracket_type === 'grand_final_reset') {
          return (
            isResetMatchActive(m, tournament.matches) && m.winner_id === null
          );
        }
        return m.winner_id === null;
      });
      if (hasOpenMatch) return col.label;
    }
    return 'In Progress';
  }, [tournament, winnerRounds, loserRounds, grandFinalRounds]);

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
  const hasResetMatch = tournament.matches.some(
    (m) => m.bracket_type === 'grand_final_reset'
  );
  const showStandingsCard =
    isDoubleElimination &&
    (standings.first !== null ||
      standings.third !== null ||
      standings.fourth !== null);

  function renderBracketColumns(
    columns: RoundColumn[],
    accentVariant: 'brand' | 'coral' | 'lime'
  ) {
    return (
      <div className="overflow-x-auto pb-3">
        <div className="flex min-w-max items-stretch gap-6">
          {columns.map((roundCol, colIdx) => {
            const isSectionFinalCol = colIdx === columns.length - 1;
            const totalInBracket = columns.length;
            return (
              <div
                key={roundCol.key}
                className="flex w-72 shrink-0 flex-col"
              >
                <div className="mb-3 flex items-center justify-between rounded-xl bg-muted px-3 py-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-foreground">
                    {roundCol.label}
                  </span>
                  <Badge variant={isSectionFinalCol ? accentVariant : 'neutral'}>
                    {roundCol.matches.length}{' '}
                    {roundCol.matches.length === 1 ? 'match' : 'matches'}
                  </Badge>
                </div>

                <div className="flex flex-1 flex-col justify-around gap-4 py-2">
                  {roundCol.matches.map((match) => {
                    const isResetInactive =
                      match.bracket_type === 'grand_final_reset' &&
                      !isResetMatchActive(match, tournament!.matches);
                    const isEliminationMatch =
                      isDoubleElimination &&
                      (match.bracket_type === 'loser' ||
                        match.bracket_type === 'grand_final_reset' ||
                        (match.bracket_type === 'grand_final' && !hasResetMatch));

                    let stageLabel: string | undefined;
                    if (isDoubleElimination) {
                      if (match.bracket_type === 'grand_final') {
                        stageLabel = hasResetMatch ? 'Game 1' : 'Championship';
                      } else if (match.bracket_type === 'grand_final_reset') {
                        stageLabel = 'Game 2 (Reset)';
                      } else if (match.bracket_type === 'winner') {
                        stageLabel =
                          roundCol.round === totalInBracket
                            ? 'Winners Final'
                            : `Upper R${roundCol.round} · M${match.match_order}`;
                      } else {
                        stageLabel =
                          roundCol.round === totalInBracket
                            ? 'Losers Final'
                            : `Lower R${roundCol.round} · M${match.match_order}`;
                      }
                    }

                    return (
                      <BracketMatchCard
                        key={match.id}
                        match={match}
                        participant1={
                          match.participant1_id
                            ? (participantById.get(match.participant1_id) ?? null)
                            : null
                        }
                        participant2={
                          match.participant2_id
                            ? (participantById.get(match.participant2_id) ?? null)
                            : null
                        }
                        myMemberId={myMemberId}
                        isFinal={
                          isDoubleElimination
                            ? match.bracket_type === 'grand_final' ||
                              match.bracket_type === 'grand_final_reset'
                            : isSectionFinalCol
                        }
                        stageLabel={stageLabel}
                        isEliminationMatch={isEliminationMatch}
                        loserDestinationLabel={getLoserDestinationLabel(
                          match,
                          tournament!.matches,
                          tournament!.format
                        )}
                        isResetInactive={isResetInactive}
                        onSelect={(m, preselectedWinnerId) =>
                          setSelectedMatchState({
                            matchId: m.id,
                            preselectedWinnerId,
                          })
                        }
                        onResolveConflict={handleResolveConflict}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

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
              <Badge variant={isDoubleElimination ? 'brand' : 'neutral'}>
                {isDoubleElimination ? 'Double Elimination' : 'Single Elimination'}
              </Badge>
            </span>
          }
          description={`Created ${formatDate(dateOnly, 'long')} · ${bracketSize}-team Doubles ${isDoubleElimination ? 'Double Elimination' : 'Knockout'}${isDoubleElimination ? (tournament.has_grand_final_reset ? ' · Grand Final Reset Enabled' : ' · Single Grand Final') : ''}`}
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
                  {isDoubleElimination
                    ? 'Crowned Double Elimination Grand Champions!'
                    : `Undefeated through ${winnerRounds.length} knockout round${winnerRounds.length === 1 ? '' : 's'}!`}
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

      {/* Top 4 Standings / Podium (Double Elimination) */}
      {showStandingsCard && (
        <Card>
          <CardHeader>
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Medal className="size-5 text-brand-strong" />
                <span>Tournament Standings</span>
              </CardTitle>
              <span className="text-xs font-semibold text-muted-foreground">
                Updates automatically as Losers Finals and Grand Finals finish
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  {
                    place: '1st Place',
                    subtitle: 'Champions',
                    pair: standings.first,
                    tone: 'bg-lime-soft text-lime-strong border-border',
                    badgeVariant: 'lime' as const,
                  },
                  {
                    place: '2nd Place',
                    subtitle: 'Runners-Up',
                    pair: standings.second,
                    tone: 'bg-brand-soft/60 text-brand-strong border-border',
                    badgeVariant: 'brand' as const,
                  },
                  ...(tournament.participants.length >= 3
                    ? [
                        {
                          place: '3rd Place',
                          subtitle: 'Losers Finalist',
                          pair: standings.third,
                          tone: 'bg-butter-soft/75 text-butter-strong border-border',
                          badgeVariant: 'butter' as const,
                        },
                      ]
                    : []),
                  ...(tournament.participants.length >= 4
                    ? [
                        {
                          place: '4th Place',
                          subtitle: 'Losers Semifinalist',
                          pair: standings.fourth,
                          tone: 'bg-muted/60 text-foreground border-border',
                          badgeVariant: 'neutral' as const,
                        },
                      ]
                    : []),
                ] as const
              ).map((slot) => (
                <div
                  key={slot.place}
                  className={cn('rounded-2xl border p-3.5', slot.tone)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={slot.badgeVariant}>{slot.place}</Badge>
                    <span className="text-[11px] font-bold opacity-80">
                      {slot.subtitle}
                    </span>
                  </div>
                  {slot.pair ? (
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex -space-x-1.5 shrink-0">
                        <Avatar
                          name={slot.pair.player1_name}
                          emoji={slot.pair.member?.emoji}
                          color={slot.pair.member?.color}
                          compact
                          className="size-7 text-[10px]"
                        />
                        <Avatar
                          name={slot.pair.player2_name}
                          emoji={slot.pair.partner?.emoji}
                          color={slot.pair.partner?.color}
                          compact
                          className="size-7 text-[10px]"
                        />
                      </div>
                      <span className="truncate text-sm font-extrabold">
                        {formatPairName(slot.pair)}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-2.5 text-xs font-semibold italic opacity-70">
                      Pending match result
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
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
          value={championPair ? formatPairName(championPair) : currentStageLabel}
          hint={formatDate(dateOnly)}
          icon={championPair ? Crown : Calendar}
          tone={championPair ? 'lime' : 'coral'}
        />
      </div>

      {/* Interactive Knockout Bracket Tree */}
      <Card>
        <CardHeader>
          <div className="flex w-full flex-col gap-3">
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <CardTitle>
                {isDoubleElimination
                  ? 'Double Elimination Brackets'
                  : 'Doubles Knockout Bracket'}
              </CardTitle>
              <span className="text-xs font-semibold text-muted-foreground">
                Click any match or &ldquo;Win&rdquo; button to pick the winner and optionally enter scores
              </span>
            </div>

            {isDoubleElimination && (
              <div className="overflow-x-auto pb-1">
                <Tabs<BracketViewTab>
                  label="Bracket view"
                  value={bracketTab}
                  onChange={setBracketTab}
                  options={[
                    {
                      value: 'all',
                      label: 'Full Bracket',
                      count: playableMatchesStats.total,
                    },
                    {
                      value: 'winner',
                      label: 'Winners Bracket',
                      count: playableMatchesStats.winnerTotal,
                    },
                    ...(loserRounds.length > 0
                      ? [
                          {
                            value: 'loser' as const,
                            label: 'Losers Bracket',
                            count: playableMatchesStats.loserTotal,
                          },
                        ]
                      : []),
                    {
                      value: 'grand_final',
                      label: 'Grand Finals',
                      count: playableMatchesStats.grandFinalTotal,
                    },
                  ]}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {!isDoubleElimination ? (
            renderBracketColumns(winnerRounds, 'lime')
          ) : (
            <>
              {(bracketTab === 'all' || bracketTab === 'winner') &&
                winnerRounds.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="brand">Upper</Badge>
                        <h3 className="text-sm font-extrabold uppercase tracking-wide text-foreground">
                          Winners Bracket
                        </h3>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        Undefeated pairs — losing drops to the Losers Bracket
                      </span>
                    </div>
                    {renderBracketColumns(winnerRounds, 'brand')}
                  </section>
                )}

              {(bracketTab === 'all' || bracketTab === 'loser') &&
                loserRounds.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="coral">Lower</Badge>
                        <h3 className="text-sm font-extrabold uppercase tracking-wide text-foreground">
                          Losers Bracket
                        </h3>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        Elimination matches — 1 more loss knocks a pair out
                      </span>
                    </div>
                    {renderBracketColumns(loserRounds, 'coral')}
                  </section>
                )}

              {(bracketTab === 'all' || bracketTab === 'grand_final') &&
                grandFinalRounds.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="lime">Championship</Badge>
                        <h3 className="text-sm font-extrabold uppercase tracking-wide text-foreground">
                          Grand Finals
                        </h3>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {hasResetMatch
                          ? 'Winners Champion needs 1 win; Losers Champion must win Game 1 & Reset'
                          : 'Winner-take-all championship match'}
                      </span>
                    </div>
                    {renderBracketColumns(grandFinalRounds, 'lime')}
                  </section>
                )}
            </>
          )}
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
