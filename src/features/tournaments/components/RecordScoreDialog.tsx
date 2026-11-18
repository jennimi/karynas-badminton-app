import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, RotateCcw, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { cn } from '../../../shared/lib/cn';
import { Avatar } from '../../../shared/ui/avatar';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { Field } from '../../../shared/ui/field';
import { Input } from '../../../shared/ui/input';
import { useAdmin } from '../../payments/useAdmin';
import { recordMatchScore } from '../api';
import { detectMatchPlayerConflicts, formatPairName } from '../bracket';
import type {
  MatchPlayerConflict,
  TournamentMatch,
  TournamentParticipantWithMember,
} from '../types';

interface RecordScoreDialogProps {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  groupId: string;
  match: TournamentMatch;
  participant1: TournamentParticipantWithMember | null;
  participant2: TournamentParticipantWithMember | null;
  initialWinnerId?: string | null;
  onResolveConflict?: (
    match: TournamentMatch,
    conflict: MatchPlayerConflict
  ) => void;
}

export function RecordScoreDialog({
  open,
  onClose,
  tournamentId,
  groupId,
  match,
  participant1,
  participant2,
  initialWinnerId,
  onResolveConflict,
}: RecordScoreDialogProps) {
  const queryClient = useQueryClient();
  const { isAdmin } = useAdmin(groupId);

  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(
    initialWinnerId !== undefined ? initialWinnerId : match.winner_id
  );
  const [score1, setScore1] = useState<string>(
    match.score_1 !== null ? String(match.score_1) : ''
  );
  const [score2, setScore2] = useState<string>(
    match.score_2 !== null ? String(match.score_2) : ''
  );
  const [court, setCourt] = useState<string>(
    match.court !== null ? String(match.court) : ''
  );
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const conflicts = useMemo(
    () => detectMatchPlayerConflicts(participant1, participant2),
    [participant1, participant2]
  );

  const hasExistingResult =
    match.winner_id !== null || match.score_1 !== null || match.score_2 !== null;

  function handleScoreChange(slot: 1 | 2, val: string) {
    if (slot === 1) setScore1(val);
    else setScore2(val);

    const nextS1 = slot === 1 ? val : score1;
    const nextS2 = slot === 2 ? val : score2;
    const n1 = parseInt(nextS1, 10);
    const n2 = parseInt(nextS2, 10);
    if (!Number.isNaN(n1) && !Number.isNaN(n2) && n1 !== n2 && participant1 && participant2) {
      setSelectedWinnerId(n1 > n2 ? participant1.id : participant2.id);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      winnerId: string | null;
      s1: number | null;
      s2: number | null;
    }) => {
      const parsedCourt = court.trim() ? parseInt(court.trim(), 10) : null;
      await recordMatchScore({
        matchId: match.id,
        tournamentId,
        winnerId: payload.winnerId,
        score1: payload.s1,
        score2: payload.s2,
        court: Number.isNaN(parsedCourt) ? null : parsedCourt,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      queryClient.invalidateQueries({
        queryKey: ['tournamentBracket', tournamentId],
      });
      queryClient.invalidateQueries({ queryKey: ['tournaments', groupId] });
      if (
        variables.winnerId === null &&
        variables.s1 === null &&
        variables.s2 === null
      ) {
        toast.success('Match reset.');
      } else {
        toast.success('Match updated!');
      }
      setConfirmResetOpen(false);
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Could not update match');
    },
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed1 = score1.trim();
    const trimmed2 = score2.trim();

    const parsed1 = trimmed1 === '' ? null : parseInt(trimmed1, 10);
    const parsed2 = trimmed2 === '' ? null : parseInt(trimmed2, 10);

    if (
      (parsed1 !== null && (Number.isNaN(parsed1) || parsed1 < 0)) ||
      (parsed2 !== null && (Number.isNaN(parsed2) || parsed2 < 0))
    ) {
      toast.error('Scores must be whole numbers (0 or higher), or left blank.');
      return;
    }

    saveMutation.mutate({
      winnerId: selectedWinnerId,
      s1: parsed1,
      s2: parsed2,
    });
  }

  if (!participant1 || !participant2) return null;

  const pair1Name = formatPairName(participant1);
  const pair2Name = formatPairName(participant2);

  const matchHeading =
    match.bracket_type === 'grand_final'
      ? 'Grand Final'
      : match.bracket_type === 'grand_final_reset'
        ? 'Grand Final Reset'
        : match.bracket_type === 'loser'
          ? `Losers R${match.round} · Match ${match.match_order}`
          : `Match ${match.match_order}`;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={`${matchHeading} — Winner & Score`}
        description="Pick the winning pair immediately, or edit scores before/after the match. Switching the winner automatically fixes downstream rounds."
      >
        <form onSubmit={handleSave} className="space-y-4">
          {conflicts.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-coral bg-coral-soft/70 p-3 text-xs text-coral-strong">
              <div className="flex items-center gap-2 font-extrabold">
                <AlertTriangle className="size-4 shrink-0" />
                <span>
                  Conflict: {conflicts.map((c) => c.playerName).join(', ')} on both opposing pairs!
                </span>
              </div>
              {onResolveConflict && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onResolveConflict(match, conflicts[0])}
                >
                  Sub / Replace Player
                </Button>
              )}
            </div>
          )}

          {/* 1. Direct Winner Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Select match winner</span>
              {selectedWinnerId !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedWinnerId(null)}
                  className="cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  Mark as in-progress (no winner yet)
                </button>
              )}
            </div>

            <div className="grid gap-2">
              <WinnerOptionCard
                participant={participant1}
                pairName={pair1Name}
                selected={selectedWinnerId === participant1.id}
                tone="brand"
                onSelect={() => setSelectedWinnerId(participant1.id)}
              />
              <WinnerOptionCard
                participant={participant2}
                pairName={pair2Name}
                selected={selectedWinnerId === participant2.id}
                tone="coral"
                onSelect={() => setSelectedWinnerId(participant2.id)}
              />
            </div>
          </div>

          {/* 2. Optional Scores (editable before or after) */}
          <div className="space-y-2 rounded-2xl border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                Scores (Optional — editable anytime)
              </span>
              {(score1 !== '' || score2 !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setScore1('');
                    setScore2('');
                  }}
                  className="cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  Clear scores
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="score-pair-1"
                  className="block truncate text-xs font-bold"
                >
                  {pair1Name}
                </label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="score-pair-1"
                    type="number"
                    min={0}
                    placeholder="—"
                    value={score1}
                    onChange={(e) => handleScoreChange(1, e.target.value)}
                    className="text-center text-base font-extrabold"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleScoreChange(1, '21')}
                    className="px-2.5 text-xs"
                  >
                    21
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="score-pair-2"
                  className="block truncate text-xs font-bold"
                >
                  {pair2Name}
                </label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="score-pair-2"
                    type="number"
                    min={0}
                    placeholder="—"
                    value={score2}
                    onChange={(e) => handleScoreChange(2, e.target.value)}
                    className="text-center text-base font-extrabold"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleScoreChange(2, '21')}
                    className="px-2.5 text-xs"
                  >
                    21
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Field label="Court number" htmlFor="match-court" hint="Optional">
            <Input
              id="match-court"
              type="number"
              min={1}
              placeholder="e.g. 1"
              value={court}
              onChange={(e) => setCourt(e.target.value)}
            />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {hasExistingResult ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  if (isAdmin) {
                    saveMutation.mutate({ winnerId: null, s1: null, s2: null });
                  } else {
                    setConfirmResetOpen(true);
                  }
                }}
                disabled={saveMutation.isPending}
              >
                <RotateCcw className="size-3.5" />
                Reset match
              </Button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="lime" disabled={saveMutation.isPending}>
                <Trophy className="size-4" />
                {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={() =>
          saveMutation.mutate({ winnerId: null, s1: null, s2: null })
        }
        title="Reset match result & score?"
        description="This will clear the winner and scores for this match and remove any advanced team from downstream rounds."
        confirmLabel="Reset match"
        isLoading={saveMutation.isPending}
      />
    </>
  );
}

function WinnerOptionCard({
  participant,
  pairName,
  selected,
  tone,
  onSelect,
}: {
  participant: TournamentParticipantWithMember;
  pairName: string;
  selected: boolean;
  tone: 'brand' | 'coral';
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-all',
        selected
          ? 'border-lime-strong bg-lime-soft text-lime-strong shadow-soft'
          : 'border-border bg-card hover:bg-muted/60'
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex -space-x-1.5 shrink-0">
          <Avatar
            name={participant.player1_name}
            emoji={participant.member?.emoji}
            color={participant.member?.color}
            compact
            className="size-7 text-[11px]"
          />
          <Avatar
            name={participant.player2_name}
            emoji={participant.partner?.emoji}
            color={participant.partner?.color}
            compact
            className="size-7 text-[11px]"
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {participant.seed !== null && (
              <Badge variant={selected ? 'lime' : tone}>
                #{participant.seed}
              </Badge>
            )}
            <span className="truncate font-extrabold">{pairName}</span>
          </div>
          {(!participant.member_id || !participant.partner_member_id) && (
            <span className="text-[11px] font-semibold opacity-80">
              Includes Guest player
            </span>
          )}
        </div>
      </div>

      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold',
          selected
            ? 'bg-lime text-ink'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {selected ? (
          <>
            <Trophy className="size-3.5" />
            <span>Winner</span>
          </>
        ) : (
          <>
            <Check className="size-3.5" />
            <span>Pick Winner</span>
          </>
        )}
      </span>
    </button>
  );
}
