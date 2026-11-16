import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, UserCog } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../../../shared/lib/cn';
import { Avatar } from '../../../shared/ui/avatar';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { Field } from '../../../shared/ui/field';
import { Input } from '../../../shared/ui/input';
import { getMembers } from '../../members/api';
import { updateTournamentParticipant } from '../api';
import {
  formatPairName,
  getMultiTeamPlayerCounts,
  getPlayerIdentityKey,
  resolvePlayerIdentity,
} from '../bracket';
import type {
  MatchPlayerConflict,
  TournamentParticipantWithMember,
} from '../types';

interface EditTournamentPairDialogProps {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  groupId: string;
  sessionId?: string | null;
  participant: TournamentParticipantWithMember;
  opposingParticipant?: TournamentParticipantWithMember | null;
  conflict?: MatchPlayerConflict | null;
  allParticipants: TournamentParticipantWithMember[];
}

export function EditTournamentPairDialog({
  open,
  onClose,
  tournamentId,
  groupId,
  sessionId,
  participant,
  opposingParticipant,
  conflict,
  allParticipants,
}: EditTournamentPairDialogProps) {
  const queryClient = useQueryClient();

  const isConflictMode = Boolean(conflict && opposingParticipant);

  // In conflict mode, default to editing the second team so the user can swap in 1 click
  const [targetSide, setTargetSide] = useState<'pair1' | 'pair2'>(
    isConflictMode ? 'pair2' : 'pair1'
  );

  const activeParticipant =
    isConflictMode && targetSide === 'pair2' && opposingParticipant
      ? opposingParticipant
      : participant;

  const initialSlot: 1 | 2 =
    isConflictMode && conflict
      ? targetSide === 'pair2'
        ? conflict.pair2Slot
        : conflict.pair1Slot
      : 1;

  const [p1Name, setP1Name] = useState(activeParticipant.player1_name);
  const [p2Name, setP2Name] = useState(activeParticipant.player2_name);
  const [activeSlot, setActiveSlot] = useState<1 | 2>(initialSlot);

  const { data: members = [] } = useQuery({
    queryKey: ['members', groupId],
    queryFn: () => getMembers(groupId),
    enabled: open && Boolean(groupId),
  });

  const resolvedP1 = useMemo(
    () => resolvePlayerIdentity(p1Name, members),
    [p1Name, members]
  );
  const resolvedP2 = useMemo(
    () => resolvePlayerIdentity(p2Name, members),
    [p2Name, members]
  );

  // Track which members are already playing elsewhere in the tournament
  const otherTeamCounts = useMemo(() => {
    const others = allParticipants
      .filter((p) => p.id !== activeParticipant.id)
      .map((p) => ({
        player1Name: p.player1_name,
        player1MemberId: p.member_id,
        player2Name: p.player2_name,
        player2MemberId: p.partner_member_id,
      }));
    return getMultiTeamPlayerCounts(others);
  }, [allParticipants, activeParticipant.id]);

  // Prioritize members NOT in this match / NOT already in another team first
  const sortedSubstituteMembers = useMemo(() => {
    const opposingKeys = new Set<string>();
    const otherSide =
      isConflictMode && targetSide === 'pair2' ? participant : opposingParticipant;
    if (otherSide) {
      opposingKeys.add(getPlayerIdentityKey(otherSide.player1_name, otherSide.member_id));
      opposingKeys.add(
        getPlayerIdentityKey(otherSide.player2_name, otherSide.partner_member_id)
      );
    }

    const currentPartnerKey =
      activeSlot === 1
        ? getPlayerIdentityKey(resolvedP2.name, resolvedP2.member?.id ?? null)
        : getPlayerIdentityKey(resolvedP1.name, resolvedP1.member?.id ?? null);

    return [...members]
      .filter((m) => getPlayerIdentityKey(m.name, m.id) !== currentPartnerKey)
      .sort((a, b) => {
        const keyA = getPlayerIdentityKey(a.name, a.id);
        const keyB = getPlayerIdentityKey(b.name, b.id);
        const inOpposingA = opposingKeys.has(keyA) ? 1 : 0;
        const inOpposingB = opposingKeys.has(keyB) ? 1 : 0;
        if (inOpposingA !== inOpposingB) return inOpposingA - inOpposingB;

        const countA = otherTeamCounts.get(keyA) ?? 0;
        const countB = otherTeamCounts.get(keyB) ?? 0;
        if (countA !== countB) return countA - countB;

        return a.name.localeCompare(b.name);
      });
  }, [
    members,
    isConflictMode,
    targetSide,
    participant,
    opposingParticipant,
    activeSlot,
    resolvedP1,
    resolvedP2,
    otherTeamCounts,
  ]);

  function handleSwitchTeam(side: 'pair1' | 'pair2') {
    if (!opposingParticipant) return;
    setTargetSide(side);
    const nextPair = side === 'pair1' ? participant : opposingParticipant;
    setP1Name(nextPair.player1_name);
    setP2Name(nextPair.player2_name);
    if (conflict) {
      setActiveSlot(side === 'pair1' ? conflict.pair1Slot : conflict.pair2Slot);
    }
  }

  function applyQuickSubstitute(nextName: string) {
    if (activeSlot === 1) {
      setP1Name(nextName);
    } else {
      setP2Name(nextName);
    }
  }

  const p1Key = getPlayerIdentityKey(resolvedP1.name, resolvedP1.member?.id ?? null);
  const p2Key = getPlayerIdentityKey(resolvedP2.name, resolvedP2.member?.id ?? null);
  const isSelfPartner = Boolean(p1Key && p2Key && p1Key === p2Key);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateTournamentParticipant({
        participantId: activeParticipant.id,
        tournamentId,
        player1Name: resolvedP1.name,
        player1MemberId: resolvedP1.member?.id ?? null,
        player2Name: resolvedP2.name,
        player2MemberId: resolvedP2.member?.id ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['tournaments', groupId] });
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: ['sessionTournaments', sessionId] });
      }
      toast.success(
        isConflictMode
          ? 'Player substituted and match conflict resolved!'
          : 'Doubles pair updated!'
      );
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Could not update doubles pair');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvedP1.name || !resolvedP2.name) {
      toast.error('Enter both Player 1 and Player 2 names.');
      return;
    }
    if (isSelfPartner) {
      toast.error('A player cannot be partnered with themselves on the same doubles team.');
      return;
    }
    saveMutation.mutate();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={
        isConflictMode
          ? 'Sub / Replace Conflicting Player'
          : `Edit Team${activeParticipant.seed !== null ? ` · Seed #${activeParticipant.seed}` : ''}`
      }
      description={
        isConflictMode
          ? 'Choose which team gets a substitute player. All existing bracket progress and scores remain intact.'
          : 'Swap or substitute a player on this doubles team mid-tournament without resetting bracket matches.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Conflict Alert & Team Selector */}
        {isConflictMode && conflict && opposingParticipant && (
          <div className="space-y-2.5 rounded-2xl border border-coral bg-coral-soft/55 p-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-coral-strong">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                {conflict.playerName} is currently on both teams in this match! Pick which team to sub:
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { side: 'pair1' as const, pair: participant },
                  { side: 'pair2' as const, pair: opposingParticipant },
                ] as const
              ).map(({ side, pair }) => {
                const selected = targetSide === side;
                return (
                  <button
                    key={pair.id}
                    type="button"
                    onClick={() => handleSwitchTeam(side)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition-all',
                      selected
                        ? 'border-brand bg-card text-foreground ring-2 ring-brand'
                        : 'border-border bg-card/70 text-muted-foreground hover:bg-card'
                    )}
                  >
                    <span className="truncate">
                      {pair.seed !== null ? `#${pair.seed} ` : ''}
                      {formatPairName(pair)}
                    </span>
                    {selected && <Badge variant="brand">Editing</Badge>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Editable Player Slots */}
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                slot: 1 as const,
                label: 'Player 1',
                value: p1Name,
                setValue: setP1Name,
                resolved: resolvedP1,
                keyStr: p1Key,
              },
              {
                slot: 2 as const,
                label: 'Player 2',
                value: p2Name,
                setValue: setP2Name,
                resolved: resolvedP2,
                keyStr: p2Key,
              },
            ] as const
          ).map(({ slot, label, value, setValue, resolved, keyStr }) => {
            const isSlotFocused = activeSlot === slot;
            const isConflictSlot =
              isConflictMode &&
              conflict &&
              ((targetSide === 'pair1' && conflict.pair1Slot === slot) ||
                (targetSide === 'pair2' && conflict.pair2Slot === slot));
            const extraTeams = keyStr ? (otherTeamCounts.get(keyStr) ?? 0) : 0;

            return (
              <div
                key={slot}
                onClick={() => setActiveSlot(slot)}
                className={cn(
                  'space-y-2 rounded-2xl border p-3 transition-all',
                  isSlotFocused
                    ? 'border-brand bg-brand-soft/30'
                    : 'border-border bg-muted/30'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                  <div className="flex items-center gap-1">
                    {isConflictSlot && (
                      <Badge variant="coral" className="px-1.5 py-0 text-[10px]">
                        Conflict Slot
                      </Badge>
                    )}
                    {isSlotFocused && (
                      <Badge variant="brand" className="px-1.5 py-0 text-[10px]">
                        Target
                      </Badge>
                    )}
                  </div>
                </div>

                <Field label={`${label} name`} htmlFor={`edit-pair-p${slot}`}>
                  <Input
                    id={`edit-pair-p${slot}`}
                    value={value}
                    list="edit-pair-member-suggestions"
                    onFocus={() => setActiveSlot(slot)}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Member or Guest name"
                  />
                </Field>

                <div className="flex items-center gap-2 text-xs">
                  <Avatar
                    name={resolved.name || '?'}
                    emoji={resolved.member?.emoji}
                    color={resolved.member?.color}
                    compact
                    className="size-6 text-[10px]"
                  />
                  {resolved.name ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-bold">{resolved.name}</span>
                      {!resolved.member && (
                        <Badge variant="butter" className="px-1.5 py-0 text-[10px]">
                          Guest
                        </Badge>
                      )}
                      {extraTeams > 0 && (
                        <Badge variant="butter" className="px-1.5 py-0 text-[10px]">
                          On {extraTeams + 1} teams
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Enter a name</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <datalist id="edit-pair-member-suggestions">
          {members.map((m) => (
            <option key={m.id} value={m.name} />
          ))}
        </datalist>

        {/* Quick Substitute Member Chips */}
        {sortedSubstituteMembers.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span>
                Quick-pick replacement for Player {activeSlot}:
              </span>
              <button
                type="button"
                onClick={() => applyQuickSubstitute('Guest Sub')}
                className="cursor-pointer text-brand-strong hover:underline"
              >
                + Use Guest Sub
              </button>
            </div>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-2xl border border-border bg-muted/30 p-2">
              {sortedSubstituteMembers.map((m) => {
                const mKey = getPlayerIdentityKey(m.name, m.id);
                const extraCount = otherTeamCounts.get(mKey) ?? 0;
                const isSelectedInSlot =
                  (activeSlot === 1 && resolvedP1.member?.id === m.id) ||
                  (activeSlot === 2 && resolvedP2.member?.id === m.id);

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => applyQuickSubstitute(m.name)}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors',
                      isSelectedInSlot
                        ? 'border-brand bg-brand text-ink'
                        : 'border-border bg-card text-foreground hover:bg-brand-soft hover:text-brand-strong'
                    )}
                  >
                    <Avatar
                      name={m.name}
                      emoji={m.emoji}
                      color={m.color}
                      compact
                      className="size-4 text-[8px]"
                    />
                    <span>{m.name}</span>
                    {extraCount > 0 && (
                      <span className="text-[10px] opacity-70">(in {extraCount})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isSelfPartner && (
          <p role="alert" className="text-xs font-bold text-coral-strong">
            Player 1 and Player 2 cannot be the same person on one team.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="lime"
            disabled={
              saveMutation.isPending ||
              !resolvedP1.name ||
              !resolvedP2.name ||
              isSelfPartner
            }
          >
            {saveMutation.isPending ? (
              'Saving…'
            ) : isConflictMode ? (
              <>
                <UserCog className="size-4" />
                Save Substitution
              </>
            ) : (
              <>
                <Check className="size-4" />
                Save Team Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
