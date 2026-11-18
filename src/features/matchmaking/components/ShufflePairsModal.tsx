import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Swords,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../../../shared/lib/cn';
import type { Member, SessionWithParticipants } from '../../../shared/types';
import { Avatar } from '../../../shared/ui/avatar';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { Input } from '../../../shared/ui/input';
import { Tabs } from '../../../shared/ui/tabs';
import { formatDate } from '../../../shared/utils/format';
import { createTournament } from '../../tournaments/api';
import { setPendingTournamentFormatDraft } from '../../tournaments/bracket';
import type { DraftDoublesPair, TournamentFormat } from '../../tournaments/types';
import {
  ODD_GUEST_KEY,
  buildSessionShufflePool,
  createShufflePlayerFromInput,
  formatShuffleForWhatsApp,
  generateShuffledPairs,
  getShufflePlayerCounts,
  reapplyOddMode,
  swapShuffleLocations,
  toDraftDoublesPairs,
  type OddPlayerMode,
  type ShuffleLocation,
  type ShufflePlayer,
  type ShuffleResult,
} from '../shuffle';

interface ShufflePairsModalProps {
  open: boolean;
  onClose: () => void;
  session: SessionWithParticipants;
  members: Member[];
  onCustomizeTournament: (pairs: DraftDoublesPair[]) => void;
}

function isSameLocation(a: ShuffleLocation | null, b: ShuffleLocation): boolean {
  if (!a || a.area !== b.area) return false;
  if (a.area === 'bench' && b.area === 'bench') {
    return a.benchIndex === b.benchIndex;
  }
  if (a.area === 'pair' && b.area === 'pair') {
    return a.pairIndex === b.pairIndex && a.slot === b.slot;
  }
  return false;
}

export function ShufflePairsModal({
  open,
  onClose,
  session,
  members,
  onCustomizeTournament,
}: ShufflePairsModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [extraPlayers, setExtraPlayers] = useState<ShufflePlayer[]>([]);
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(() => new Set());
  const [oddMode, setOddMode] = useState<OddPlayerMode>('bench');
  const [oddGuestName, setOddGuestName] = useState('Guest Partner');
  const [preferredDoubleUpKey, setPreferredDoubleUpKey] = useState<string | null>(null);
  const [quickPlayerInput, setQuickPlayerInput] = useState('');
  const [selectedLoc, setSelectedLoc] = useState<ShuffleLocation | null>(null);
  const [dragFromLoc, setDragFromLoc] = useState<ShuffleLocation | null>(null);
  const [copiedRecently, setCopiedRecently] = useState(false);
  const [tournamentFormat, setTournamentFormat] =
    useState<TournamentFormat>('single_elimination');
  const [hasGrandFinalReset, setHasGrandFinalReset] = useState(true);

  const [shuffleState, setShuffleState] = useState<ShuffleResult>(() =>
    generateShuffledPairs(buildSessionShufflePool(session.participants), 'bench')
  );

  const basePool = useMemo(
    () => buildSessionShufflePool(session.participants, extraPlayers),
    [session.participants, extraPlayers]
  );

  const activePool = useMemo(
    () => basePool.filter((p) => !removedKeys.has(p.key)),
    [basePool, removedKeys]
  );

  const playerCounts = useMemo(
    () => getShufflePlayerCounts(shuffleState.pairs),
    [shuffleState.pairs]
  );

  const availableGroupMembers = useMemo(() => {
    const activeMemberIds = new Set(
      activePool.map((p) => p.memberId).filter((id): id is string => Boolean(id))
    );
    return members.filter((m) => !activeMemberIds.has(m.id));
  }, [members, activePool]);

  const doubleUpCandidates = useMemo(() => {
    if (shuffleState.pairs.length === 0) return [];
    let excludedLeftoverKey: string | null = null;
    if (shuffleState.doubledUpPlayerKey) {
      for (let i = shuffleState.pairs.length - 1; i >= 0; i--) {
        const pair = shuffleState.pairs[i];
        if (pair.player1.key === shuffleState.doubledUpPlayerKey) {
          excludedLeftoverKey = pair.player2.key;
          break;
        }
        if (pair.player2.key === shuffleState.doubledUpPlayerKey) {
          excludedLeftoverKey = pair.player1.key;
          break;
        }
      }
    }

    const unique = new Map<string, ShufflePlayer>();
    for (const pair of shuffleState.pairs) {
      if (pair.player1.key !== excludedLeftoverKey && !unique.has(pair.player1.key)) {
        unique.set(pair.player1.key, pair.player1);
      }
      if (pair.player2.key !== excludedLeftoverKey && !unique.has(pair.player2.key)) {
        unique.set(pair.player2.key, pair.player2);
      }
    }
    return Array.from(unique.values());
  }, [shuffleState.pairs, shuffleState.doubledUpPlayerKey]);

  const defaultTournamentName = `${session.title?.trim() || formatDate(session.date, 'short')} Tournament`;

  const launchMutation = useMutation({
    mutationFn: () =>
      createTournament({
        groupId: session.group_id,
        sessionId: session.id,
        name: defaultTournamentName,
        pairs: toDraftDoublesPairs(shuffleState.pairs),
        format: tournamentFormat,
        hasGrandFinalReset,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments', session.group_id] });
      queryClient.invalidateQueries({ queryKey: ['sessionTournaments', session.id] });
      toast.success(`Tournament "${created.name}" launched!`);
      onClose();
      navigate(`/tournaments/${created.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Could not launch tournament');
    },
  });

  function regenerateWithPool(
    nextPool: ShufflePlayer[],
    nextOddMode: OddPlayerMode = oddMode,
    nextGuestName: string = oddGuestName,
    nextDoubleUpKey: string | null = preferredDoubleUpKey
  ) {
    setSelectedLoc(null);
    setShuffleState(
      generateShuffledPairs(nextPool, nextOddMode, {
        guestName: nextGuestName,
        preferredDoubleUpKey: nextDoubleUpKey,
      })
    );
  }

  function handleReshuffle() {
    regenerateWithPool(activePool, oddMode, oddGuestName, preferredDoubleUpKey);
  }

  function handleOddModeChange(nextMode: OddPlayerMode) {
    setOddMode(nextMode);
    setSelectedLoc(null);
    setShuffleState((prev) =>
      reapplyOddMode(prev, activePool, nextMode, {
        guestName: oddGuestName,
        preferredDoubleUpKey,
      })
    );
  }

  function handleOddGuestNameChange(nextName: string) {
    setOddGuestName(nextName);
    setShuffleState((prev) =>
      reapplyOddMode(prev, activePool, 'guest', {
        guestName: nextName,
        preferredDoubleUpKey,
      })
    );
  }

  function handleDoubleUpPlayerChange(nextKey: string) {
    const resolvedKey = nextKey || null;
    setPreferredDoubleUpKey(resolvedKey);
    setShuffleState((prev) =>
      reapplyOddMode(prev, activePool, 'double_up', {
        guestName: oddGuestName,
        preferredDoubleUpKey: resolvedKey,
      })
    );
  }

  function handleAddQuickPlayer(e?: React.FormEvent) {
    e?.preventDefault();
    const candidate = createShufflePlayerFromInput(quickPlayerInput, members);
    if (!candidate) {
      toast.error('Enter a player or guest name to add.');
      return;
    }

    if (activePool.some((p) => p.key === candidate.key)) {
      toast.error(`${candidate.name} is already in the shuffle pool.`);
      return;
    }

    let nextRemoved = removedKeys;
    let nextExtra = extraPlayers;

    if (removedKeys.has(candidate.key)) {
      nextRemoved = new Set(removedKeys);
      nextRemoved.delete(candidate.key);
      setRemovedKeys(nextRemoved);
    } else if (!basePool.some((p) => p.key === candidate.key)) {
      nextExtra = [...extraPlayers, candidate];
      setExtraPlayers(nextExtra);
    }

    const nextPool = buildSessionShufflePool(session.participants, nextExtra).filter(
      (p) => !nextRemoved.has(p.key)
    );
    setQuickPlayerInput('');
    regenerateWithPool(nextPool);
    toast.success(`Added ${candidate.name} to shuffle.`);
  }

  function handleRemoveFromPool(player: ShufflePlayer) {
    if (activePool.length <= 2) {
      toast.error('Keep at least 2 players in the shuffle pool.');
      return;
    }
    const nextRemoved = new Set(removedKeys);
    nextRemoved.add(player.key);
    setRemovedKeys(nextRemoved);
    const nextPool = basePool.filter((p) => !nextRemoved.has(p.key));
    regenerateWithPool(nextPool);
  }

  function handleRestorePool() {
    const empty = new Set<string>();
    setRemovedKeys(empty);
    regenerateWithPool(basePool);
  }

  function performSwap(from: ShuffleLocation, to: ShuffleLocation) {
    const { result, error } = swapShuffleLocations(shuffleState, from, to);
    setSelectedLoc(null);
    if (error) {
      toast.error(error);
      return;
    }
    setShuffleState(result);
  }

  function handleTapSlot(loc: ShuffleLocation) {
    if (!selectedLoc) {
      setSelectedLoc(loc);
      return;
    }
    if (isSameLocation(selectedLoc, loc)) {
      setSelectedLoc(null);
      return;
    }
    performSwap(selectedLoc, loc);
  }

  async function handleCopyWhatsApp() {
    if (shuffleState.pairs.length === 0) return;
    const text = formatShuffleForWhatsApp({
      sessionTitle: session.title || '',
      sessionDate: session.date,
      pairs: shuffleState.pairs,
      bench: shuffleState.bench,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRecently(true);
      toast.success('Pairs copied to clipboard for WhatsApp!');
      window.setTimeout(() => setCopiedRecently(false), 2000);
    } catch {
      toast.error('Could not access clipboard. Please copy manually.');
    }
  }

  function handleCustomizeTournament() {
    if (shuffleState.pairs.length < 2) {
      toast.error('Need at least 2 doubles pairs to create a tournament.');
      return;
    }
    const draft = toDraftDoublesPairs(shuffleState.pairs);
    setPendingTournamentFormatDraft({
      format: tournamentFormat,
      hasGrandFinalReset,
    });
    onClose();
    onCustomizeTournament(draft);
  }

  const isOddCount = activePool.length % 2 === 1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="🎲 Shuffle Doubles Pairs"
      description="Randomize session participants into doubles teams, adjust for odd counts, swap partners, or launch a knockout tournament."
    >
      <div className="space-y-4">
        {/* Top summary + Re-shuffle */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/60 px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <Badge variant="brand">{activePool.length} Players</Badge>
            <Badge variant="lime">{shuffleState.pairs.length} Doubles Pairs</Badge>
            {shuffleState.bench.length > 0 && (
              <Badge variant="butter">{shuffleState.bench.length} Bench / Bye</Badge>
            )}
            {shuffleState.doubledUpPlayerKey && (
              <Badge variant="butter">1 Player 2x</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {removedKeys.size > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={handleRestorePool}>
                Restore ({removedKeys.size})
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleReshuffle}
              disabled={activePool.length < 2}
            >
              <RefreshCw className="size-3.5" />
              Re-shuffle
            </Button>
          </div>
        </div>

        {/* Odd participant count handling */}
        {isOddCount && activePool.length >= 1 && (
          <div className="space-y-2.5 rounded-2xl border border-butter bg-butter-soft/45 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-extrabold text-butter-strong">
                Odd number of players ({activePool.length}) — choose how to handle the extra player:
              </p>
            </div>

            <div className="overflow-x-auto">
              <Tabs<OddPlayerMode>
                label="Odd player handling"
                value={oddMode}
                onChange={handleOddModeChange}
                options={[
                  { value: 'bench', label: '1 Bench / Bye' },
                  { value: 'double_up', label: 'Double-Up (2 Teams)' },
                  { value: 'guest', label: '+ Guest Partner' },
                ]}
              />
            </div>

            {oddMode === 'double_up' && doubleUpCandidates.length > 0 && (
              <label className="flex flex-wrap items-center gap-2 text-xs font-bold text-foreground">
                <span>Player on 2 teams:</span>
                <select
                  value={shuffleState.doubledUpPlayerKey ?? ''}
                  onChange={(e) => handleDoubleUpPlayerChange(e.target.value)}
                  className="h-8 rounded-control border border-border bg-card px-2.5 text-xs font-bold focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {doubleUpCandidates.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {oddMode === 'guest' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-foreground">Guest name:</span>
                <Input
                  value={oddGuestName}
                  onChange={(e) => handleOddGuestNameChange(e.target.value)}
                  placeholder="Guest Partner"
                  className="h-8 max-w-52 text-xs"
                />
              </div>
            )}
          </div>
        )}

        {/* Quick-Add Guest or Extra Group Member */}
        <form onSubmit={handleAddQuickPlayer} className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-44 flex-1">
            <UserPlus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={quickPlayerInput}
              onChange={(e) => setQuickPlayerInput(e.target.value)}
              list="shuffle-member-suggestions"
              placeholder="Quick-add a guest or group member…"
              className="h-9 pl-9 text-sm"
            />
            <datalist id="shuffle-member-suggestions">
              {availableGroupMembers.map((m) => (
                <option key={m.id} value={m.name} />
              ))}
            </datalist>
          </div>
          <Button type="submit" variant="outline" size="sm" className="h-9">
            <Plus className="size-3.5" />
            Add Player
          </Button>
        </form>

        {/* Swap instructions */}
        {activePool.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ArrowLeftRight className="size-3.5 text-brand-strong" />
              {selectedLoc
                ? 'Tap another player or Bench slot to complete the swap.'
                : 'Tap any two players (or drag & drop) to swap partners.'}
            </span>
            {selectedLoc && (
              <button
                type="button"
                onClick={() => setSelectedLoc(null)}
                className="cursor-pointer font-bold text-foreground underline"
              >
                Cancel swap
              </button>
            )}
          </div>
        )}

        {/* Pairs Grid */}
        {shuffleState.pairs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Add at least 2 players above to form doubles pairs.
          </div>
        ) : (
          <div className="grid max-h-72 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {shuffleState.pairs.map((pair, pairIdx) => {
              const p1Count = playerCounts.get(pair.player1.key) ?? 1;
              const p2Count = playerCounts.get(pair.player2.key) ?? 1;

              return (
                <div
                  key={`${pair.id}-${pairIdx}`}
                  className="space-y-2 rounded-2xl border border-border bg-muted/35 p-3"
                >
                  <div className="flex items-center justify-between text-xs font-extrabold text-muted-foreground">
                    <span>Pair #{pairIdx + 1}</span>
                    {(p1Count >= 2 || p2Count >= 2) && (
                      <Badge variant="butter" className="px-1.5 py-0 text-[10px]">
                        2x Playing
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {(
                      [
                        { slot: 1 as const, player: pair.player1, count: p1Count },
                        { slot: 2 as const, player: pair.player2, count: p2Count },
                      ] as const
                    ).map(({ slot, player, count }) => {
                      const loc: ShuffleLocation = {
                        area: 'pair',
                        pairIndex: pairIdx,
                        slot,
                      };
                      const isSelected = isSameLocation(selectedLoc, loc);

                      return (
                        <div
                          key={`${pairIdx}-${slot}-${player.key}`}
                          draggable
                          onDragStart={() => setDragFromLoc(loc)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragFromLoc) {
                              performSwap(dragFromLoc, loc);
                              setDragFromLoc(null);
                            }
                          }}
                          className={cn(
                            'flex items-center gap-1 rounded-xl border bg-card pr-1 transition-all',
                            isSelected
                              ? 'border-brand bg-brand-soft/60 ring-2 ring-brand'
                              : 'border-border hover:border-brand/60'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => handleTapSlot(loc)}
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left"
                          >
                            <Avatar
                              name={player.name}
                              emoji={player.emoji}
                              color={player.color}
                              compact
                              className="size-6 text-[10px]"
                            />
                            <span className="min-w-0 flex-1 truncate text-xs font-bold">
                              {player.name}
                            </span>
                            {player.isGuest && (
                              <Badge variant="butter" className="px-1.5 py-0 text-[10px]">
                                Guest
                              </Badge>
                            )}
                            {count >= 2 && (
                              <Badge variant="brand" className="px-1.5 py-0 text-[10px]">
                                2x
                              </Badge>
                            )}
                          </button>

                          {player.key !== ODD_GUEST_KEY && activePool.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFromPool(player)}
                              aria-label={`Remove ${player.name} from shuffle`}
                              title="Exclude from shuffle"
                              className="cursor-pointer rounded-lg p-1 text-muted-foreground hover:bg-coral-soft hover:text-coral-strong"
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bench / Bye Tray */}
        {shuffleState.bench.length > 0 && (
          <div className="space-y-1.5 rounded-2xl border border-dashed border-border bg-muted/30 p-3">
            <p className="text-xs font-extrabold text-muted-foreground">
              🪑 Bench / Bye (tap or drag to swap into a pair)
            </p>
            <div className="flex flex-wrap gap-2">
              {shuffleState.bench.map((player, benchIdx) => {
                const loc: ShuffleLocation = { area: 'bench', benchIndex: benchIdx };
                const isSelected = isSameLocation(selectedLoc, loc);

                return (
                  <button
                    key={player.key}
                    type="button"
                    draggable
                    onDragStart={() => setDragFromLoc(loc)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragFromLoc) {
                        performSwap(dragFromLoc, loc);
                        setDragFromLoc(null);
                      }
                    }}
                    onClick={() => handleTapSlot(loc)}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-bold transition-all',
                      isSelected
                        ? 'border-brand bg-brand-soft ring-2 ring-brand'
                        : 'border-border hover:border-brand'
                    )}
                  >
                    <Avatar
                      name={player.name}
                      emoji={player.emoji}
                      color={player.color}
                      compact
                      className="size-5 text-[9px]"
                    />
                    <span>{player.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {shuffleState.pairs.length < 2 ? (
          <p className="rounded-xl bg-butter-soft/60 px-3 py-2 text-xs font-bold text-butter-strong">
            Form at least 2 doubles pairs to turn this session into a knockout tournament (quick-add a guest or select Double-Up if needed).
          </p>
        ) : (
          <div className="space-y-2.5 rounded-2xl border border-border bg-muted/35 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-foreground">
                <Swords className="size-3.5 text-brand-strong" />
                Tournament Format
              </span>
              <Badge variant={tournamentFormat === 'double_elimination' ? 'brand' : 'neutral'}>
                {tournamentFormat === 'double_elimination'
                  ? `${shuffleState.pairs.length * 2 - 2}${hasGrandFinalReset ? `–${shuffleState.pairs.length * 2 - 1}` : ''} matches`
                  : `${shuffleState.pairs.length - 1} matches`}
              </Badge>
            </div>

            <div className="overflow-x-auto pb-0.5">
              <Tabs<TournamentFormat>
                label="Session tournament format"
                value={tournamentFormat}
                onChange={setTournamentFormat}
                options={[
                  { value: 'single_elimination', label: 'Single Elimination' },
                  { value: 'double_elimination', label: 'Double Elimination' },
                ]}
              />
            </div>

            {tournamentFormat === 'double_elimination' && (
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
                <div className="flex items-center gap-2">
                  <RotateCcw className="size-3.5 shrink-0 text-butter-strong" />
                  <span className="text-xs font-bold text-foreground">
                    Grand Finals Reset
                    <span className="ml-1 font-semibold text-muted-foreground">
                      (Losers Champ must win twice)
                    </span>
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={hasGrandFinalReset}
                  onChange={(e) => setHasGrandFinalReset(e.target.checked)}
                  className="size-4 shrink-0 cursor-pointer accent-brand"
                />
              </label>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCopyWhatsApp()}
            disabled={shuffleState.pairs.length === 0}
          >
            {copiedRecently ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copiedRecently ? 'Copied!' : 'Copy for WhatsApp'}
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCustomizeTournament}
              disabled={shuffleState.pairs.length < 2}
            >
              <SlidersHorizontal className="size-4" />
              Customize &amp; Seed…
            </Button>

            <Button
              type="button"
              variant="lime"
              size="sm"
              onClick={() => launchMutation.mutate()}
              disabled={shuffleState.pairs.length < 2 || launchMutation.isPending}
            >
              <Trophy className="size-4" />
              {launchMutation.isPending ? 'Launching…' : 'Turn into Tournament'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
