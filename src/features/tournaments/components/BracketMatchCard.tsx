import { AlertTriangle, ArrowDownRight, Check, Pencil, ShieldAlert, Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '../../../shared/lib/cn';
import { Avatar } from '../../../shared/ui/avatar';
import { Badge } from '../../../shared/ui/badge';
import {
  detectMatchPlayerConflicts,
  formatPairName,
  isRound1ByeMatch,
} from '../bracket';
import type {
  MatchPlayerConflict,
  TournamentMatch,
  TournamentParticipantWithMember,
} from '../types';

interface BracketMatchCardProps {
  match: TournamentMatch;
  participant1: TournamentParticipantWithMember | null;
  participant2: TournamentParticipantWithMember | null;
  myMemberId: string | null;
  isFinal?: boolean;
  stageLabel?: string;
  isEliminationMatch?: boolean;
  loserDestinationLabel?: string | null;
  isResetInactive?: boolean;
  onSelect: (match: TournamentMatch, preselectedWinnerId?: string | null) => void;
  onResolveConflict?: (
    match: TournamentMatch,
    conflict: MatchPlayerConflict
  ) => void;
}

export function BracketMatchCard({
  match,
  participant1,
  participant2,
  myMemberId,
  isFinal = false,
  stageLabel,
  isEliminationMatch = false,
  loserDestinationLabel = null,
  isResetInactive = false,
  onSelect,
  onResolveConflict,
}: BracketMatchCardProps) {
  const isRound1Bye = isRound1ByeMatch(match);

  const isCompleted = match.winner_id !== null && !isRound1Bye;
  const hasBothPairs = participant1 !== null && participant2 !== null;

  const p1IsMe =
    Boolean(myMemberId) &&
    (participant1?.member_id === myMemberId ||
      participant1?.partner_member_id === myMemberId);
  const p2IsMe =
    Boolean(myMemberId) &&
    (participant2?.member_id === myMemberId ||
      participant2?.partner_member_id === myMemberId);
  const involvesMe = p1IsMe || p2IsMe;

  const p1Won = match.winner_id !== null && match.winner_id === match.participant1_id;
  const p2Won = match.winner_id !== null && match.winner_id === match.participant2_id;

  const conflicts = useMemo(
    () => detectMatchPlayerConflicts(participant1, participant2),
    [participant1, participant2]
  );

  const defaultTitle =
    match.bracket_type === 'grand_final'
      ? 'Grand Final'
      : match.bracket_type === 'grand_final_reset'
        ? 'Grand Final Reset'
        : isFinal
          ? 'Final'
          : `Match ${match.match_order}`;

  return (
    <div
      className={cn(
        'w-72 shrink-0 rounded-card border bg-card p-3 text-card-foreground shadow-soft transition-all',
        involvesMe ? 'border-brand ring-2 ring-brand' : 'border-border',
        isResetInactive && 'opacity-70'
      )}
    >
      {/* Top metadata bar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-extrabold text-muted-foreground">
            {stageLabel ?? defaultTitle}
          </span>
          {isEliminationMatch && !isRound1Bye && (
            <Badge variant="coral" className="px-1.5 py-0 text-[10px]">
              Elimination
            </Badge>
          )}
          {match.bracket_type === 'grand_final' && (
            <Badge variant="lime" className="px-1.5 py-0 text-[10px]">
              Grand Final
            </Badge>
          )}
          {match.bracket_type === 'grand_final_reset' && (
            <Badge variant="butter" className="px-1.5 py-0 text-[10px]">
              Bracket Reset
            </Badge>
          )}
          {match.court !== null && (
            <Badge variant="butter">Court {match.court}</Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {involvesMe && <Badge variant="brand">Your Team</Badge>}
          {isRound1Bye ? (
            <Badge variant="neutral">BYE</Badge>
          ) : isResetInactive ? (
            <Badge variant="neutral">If Needed</Badge>
          ) : isCompleted ? (
            <Badge variant="lime">Winner Picked</Badge>
          ) : hasBothPairs ? (
            <Badge variant="butter">Ready</Badge>
          ) : (
            <Badge variant="neutral">Waiting</Badge>
          )}
        </div>
      </div>

      {/* Doubles Pair Slots */}
      <div className="space-y-1.5">
        <DoublesSlotRow
          participant={participant1}
          score={match.score_1}
          isWinner={p1Won}
          isByeSlot={isRound1Bye && participant1 === null}
          isMe={p1IsMe}
          slotTone="brand"
          canQuickPick={hasBothPairs}
          onQuickPick={() => {
            if (participant1) onSelect(match, participant1.id);
          }}
          onOpenModal={() => {
            if (hasBothPairs) onSelect(match);
          }}
        />
        <DoublesSlotRow
          participant={participant2}
          score={match.score_2}
          isWinner={p2Won}
          isByeSlot={isRound1Bye && participant2 === null}
          isMe={p2IsMe}
          slotTone="coral"
          canQuickPick={hasBothPairs}
          onQuickPick={() => {
            if (participant2) onSelect(match, participant2.id);
          }}
          onOpenModal={() => {
            if (hasBothPairs) onSelect(match);
          }}
        />
      </div>

      {hasBothPairs && conflicts.length > 0 && (
        <div className="mt-2 space-y-1.5 rounded-xl border border-coral bg-coral-soft/70 p-2 text-xs text-coral-strong">
          {conflicts.map((conflict) => (
            <div
              key={conflict.identityKey}
              className="flex items-center justify-between gap-2"
            >
              <span className="inline-flex min-w-0 items-center gap-1 font-extrabold">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span className="truncate">
                  {conflict.playerName} on both teams
                </span>
              </span>
              {onResolveConflict && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResolveConflict(match, conflict);
                  }}
                  className="shrink-0 cursor-pointer rounded-lg bg-card px-2 py-0.5 text-[11px] font-extrabold text-coral-strong shadow-soft hover:bg-coral hover:text-ink"
                >
                  Sub / Replace
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {(loserDestinationLabel || hasBothPairs) && !isRound1Bye && (
        <div className="mt-2 space-y-1 border-t border-border/60 pt-1.5 text-[11px] font-bold">
          {loserDestinationLabel && (
            <div
              className={cn(
                'flex items-center gap-1',
                isEliminationMatch ? 'text-coral-strong' : 'text-muted-foreground'
              )}
            >
              {isEliminationMatch ? (
                <ShieldAlert className="size-3 shrink-0" />
              ) : (
                <ArrowDownRight className="size-3 shrink-0" />
              )}
              <span className="truncate">{loserDestinationLabel}</span>
            </div>
          )}

          {hasBothPairs && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => onSelect(match)}
                className="inline-flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-3" />
                <span>
                  {match.score_1 !== null || match.score_2 !== null
                    ? 'Edit score or winner'
                    : 'Add optional score / edit'}
                </span>
              </button>
              {isFinal && <Trophy className="size-3.5 text-butter-strong" />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DoublesSlotRow({
  participant,
  score,
  isWinner,
  isByeSlot,
  isMe,
  slotTone,
  canQuickPick,
  onQuickPick,
  onOpenModal,
}: {
  participant: TournamentParticipantWithMember | null;
  score: number | null;
  isWinner: boolean;
  isByeSlot: boolean;
  isMe: boolean;
  slotTone: 'brand' | 'coral';
  canQuickPick: boolean;
  onQuickPick: () => void;
  onOpenModal: () => void;
}) {
  if (!participant) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-muted/50 px-2.5 py-2.5 text-xs text-muted-foreground">
        <span className="italic font-semibold">{isByeSlot ? 'BYE' : 'TBD'}</span>
        <span>—</span>
      </div>
    );
  }

  const pairName = formatPairName(participant);
  const p1IsGuest = !participant.member_id;
  const p2IsGuest = !participant.partner_member_id;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-2xl px-2.5 py-2 text-xs transition-colors',
        isWinner
          ? 'bg-lime-soft text-lime-strong font-extrabold'
          : 'bg-muted/60 text-foreground font-semibold'
      )}
    >
      {/* Left side: clicking opens the score/winner modal */}
      <button
        type="button"
        onClick={onOpenModal}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
      >
        <div className="flex -space-x-1.5 shrink-0">
          <Avatar
            name={participant.player1_name}
            emoji={participant.member?.emoji}
            color={participant.member?.color}
            compact
            className="size-6 text-[10px]"
          />
          <Avatar
            name={participant.player2_name}
            emoji={participant.partner?.emoji}
            color={participant.partner?.color}
            compact
            className="size-6 text-[10px]"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {participant.seed !== null && (
              <Badge
                variant={isWinner ? 'lime' : slotTone}
                className="px-1.5 py-0 text-[10px]"
              >
                #{participant.seed}
              </Badge>
            )}
            <span className="truncate font-bold">{pairName}</span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
            {(p1IsGuest || p2IsGuest) && (
              <span className="font-bold text-butter-strong">
                {p1IsGuest && p2IsGuest ? '2 Guests' : '1 Guest'}
              </span>
            )}
            {isMe && (
              <span className="font-extrabold text-brand-strong">Your pair</span>
            )}
          </div>
        </div>
      </button>

      {/* Right side: optional score pill + 1-click Winner toggle */}
      <div className="flex shrink-0 items-center gap-1.5">
        {score !== null && (
          <button
            type="button"
            onClick={onOpenModal}
            className={cn(
              'inline-flex min-w-6 cursor-pointer items-center justify-center rounded-lg px-1.5 py-0.5 text-xs font-extrabold',
              isWinner
                ? 'bg-card text-lime-strong'
                : 'bg-card/80 text-muted-foreground'
            )}
            title="Edit score"
          >
            {score}
          </button>
        )}

        {canQuickPick ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickPick();
            }}
            title={
              isWinner
                ? 'Selected as winner (click other team or Edit to change)'
                : `Crown ${pairName} as match winner`
            }
            className={cn(
              'inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-[10px] font-extrabold transition-all',
              isWinner
                ? 'bg-lime text-ink shadow-soft'
                : 'bg-card text-muted-foreground hover:bg-brand-soft hover:text-brand-strong'
            )}
          >
            {isWinner ? (
              <>
                <Trophy className="size-3" />
                <span>Won</span>
              </>
            ) : (
              <>
                <Check className="size-3" />
                <span>Win</span>
              </>
            )}
          </button>
        ) : (
          isWinner && (
            <Trophy className="size-3.5 text-lime-strong" aria-label="Winner" />
          )
        )}
      </div>
    </div>
  );
}
