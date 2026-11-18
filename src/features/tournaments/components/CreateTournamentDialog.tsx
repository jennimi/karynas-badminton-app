import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Plus,
  RotateCcw,
  Shuffle,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../../../shared/lib/cn';
import { Avatar } from '../../../shared/ui/avatar';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { Field } from '../../../shared/ui/field';
import { Input } from '../../../shared/ui/input';
import { Tabs } from '../../../shared/ui/tabs';
import { Textarea } from '../../../shared/ui/textarea';
import type { Member } from '../../../shared/types';
import { getMembers } from '../../members/api';
import { useMe } from '../../members/useMe';
import { createTournament } from '../api';
import {
  getMultiTeamPlayerCounts,
  getPlayerIdentityKey,
  nextPowerOfTwo,
  parseDoublesPairLines,
  resolvePlayerIdentity,
} from '../bracket';
import type { DraftDoublesPair, TournamentFormat } from '../types';

interface CreateTournamentDialogProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  sessionId?: string | null;
  initialName?: string;
  initialPairs?: DraftDoublesPair[];
}

type EntryMode = 'list' | 'rows';

export function CreateTournamentDialog({
  open,
  onClose,
  groupId,
  sessionId,
  initialName,
  initialPairs,
}: CreateTournamentDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { memberId: myMemberId } = useMe(groupId);

  const [name, setName] = useState(initialName ?? '');
  const [format, setFormat] = useState<TournamentFormat>('single_elimination');
  const [hasGrandFinalReset, setHasGrandFinalReset] = useState(true);
  const [mode, setMode] = useState<EntryMode>(
    initialPairs && initialPairs.length > 0 ? 'rows' : 'list'
  );
  const [listText, setListText] = useState(() =>
    initialPairs && initialPairs.length > 0
      ? initialPairs.map((p) => `${p.player1Name} & ${p.player2Name}`).join('\n')
      : ''
  );
  const [customPairs, setCustomPairs] = useState<DraftDoublesPair[]>(
    () => initialPairs ?? []
  );

  // Inline quick-add row fields when in 'rows' mode
  const [draftP1, setDraftP1] = useState('');
  const [draftP2, setDraftP2] = useState('');

  const { data: members = [] } = useQuery({
    queryKey: ['members', groupId],
    queryFn: () => getMembers(groupId),
    enabled: open && Boolean(groupId),
  });

  const memberById = useMemo(() => {
    const map = new Map<string, Member>();
    for (const m of members) map.set(m.id, m);
    return map;
  }, [members]);

  // Pairs parsed live from the textarea when in 'list' mode
  const parsedFromText = useMemo(
    () => parseDoublesPairLines(listText, members),
    [listText, members]
  );

  // Active pairs depend on current mode; switching to 'rows' copies parsed pairs so user can reorder/edit
  const activePairs = mode === 'list' ? parsedFromText : customPairs;

  const playerTeamCounts = useMemo(
    () => getMultiTeamPlayerCounts(activePairs),
    [activePairs]
  );

  const assignedMemberIds = useMemo(() => {
    const usedIds = new Set<string>();
    for (const pair of activePairs) {
      if (pair.player1MemberId) usedIds.add(pair.player1MemberId);
      if (pair.player2MemberId) usedIds.add(pair.player2MemberId);
    }
    return usedIds;
  }, [activePairs]);

  // Keep all members selectable so players can intentionally join multiple teams (marked 2x)
  const sortedMembers = useMemo(() => {
    const unassigned = members.filter((m) => !assignedMemberIds.has(m.id));
    const assigned = members.filter((m) => assignedMemberIds.has(m.id));
    return [...unassigned, ...assigned];
  }, [members, assignedMemberIds]);

  const bracketSize =
    activePairs.length >= 2 ? nextPowerOfTwo(activePairs.length) : 0;
  const byeCount = bracketSize > 0 ? bracketSize - activePairs.length : 0;

  function handleModeChange(nextMode: EntryMode) {
    if (nextMode === 'rows' && mode === 'list') {
      setCustomPairs(parsedFromText);
    } else if (nextMode === 'list' && mode === 'rows' && customPairs.length > 0) {
      setListText(
        customPairs.map((p) => `${p.player1Name} & ${p.player2Name}`).join('\n')
      );
    }
    setMode(nextMode);
  }

  function appendNameToList(playerName: string) {
    setListText((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed) return `${playerName} & `;
      const lines = trimmed.split('\n');
      const lastLine = lines[lines.length - 1] ?? '';
      // If the last line ends with a delimiter or has no delimiter yet, complete the pair
      if (/(&|\/|\+|,|-)\s*$/.test(lastLine)) {
        return `${trimmed} ${playerName}\n`;
      }
      if (!/(&|\/|\+|,|\s-\s|\sand\s)/i.test(lastLine)) {
        return `${trimmed} & ${playerName}\n`;
      }
      return `${trimmed}\n${playerName} & `;
    });
  }

  function addRowPair() {
    const p1 = resolvePlayerIdentity(draftP1, members);
    const p2 = resolvePlayerIdentity(draftP2, members);
    if (!p1.name || !p2.name) {
      toast.error('Enter both Player 1 and Player 2 names (members or guests).');
      return;
    }
    const newPair: DraftDoublesPair = {
      key: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      player1Name: p1.name,
      player1MemberId: p1.member?.id ?? null,
      player2Name: p2.name,
      player2MemberId: p2.member?.id ?? null,
    };
    setCustomPairs((prev) => [...prev, newPair]);
    setDraftP1('');
    setDraftP2('');
  }

  function updateRowPlayer(
    index: number,
    slot: 1 | 2,
    rawValue: string
  ) {
    const resolved = resolvePlayerIdentity(rawValue, members);
    setCustomPairs((prev) =>
      prev.map((pair, i) => {
        if (i !== index) return pair;
        return slot === 1
          ? {
            ...pair,
            player1Name: rawValue,
            player1MemberId: resolved.member?.id ?? null,
          }
          : {
            ...pair,
            player2Name: rawValue,
            player2MemberId: resolved.member?.id ?? null,
          };
      })
    );
  }

  function removePair(index: number) {
    if (mode === 'list') {
      const next = parsedFromText.filter((_, i) => i !== index);
      setListText(next.map((p) => `${p.player1Name} & ${p.player2Name}`).join('\n'));
    } else {
      setCustomPairs((prev) => prev.filter((_, i) => i !== index));
    }
  }

  function moveSeed(index: number, direction: -1 | 1) {
    const base = mode === 'list' ? [...parsedFromText] : [...customPairs];
    const target = index + direction;
    if (target < 0 || target >= base.length) return;
    const tmp = base[index];
    base[index] = base[target];
    base[target] = tmp;

    if (mode === 'list') {
      setListText(base.map((p) => `${p.player1Name} & ${p.player2Name}`).join('\n'));
    } else {
      setCustomPairs(base);
    }
  }

  function shuffleSeeds() {
    const base = mode === 'list' ? [...parsedFromText] : [...customPairs];
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = base[i];
      base[i] = base[j];
      base[j] = tmp;
    }
    if (mode === 'list') {
      setListText(base.map((p) => `${p.player1Name} & ${p.player2Name}`).join('\n'));
    } else {
      setCustomPairs(base);
    }
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createTournament({
        groupId,
        sessionId,
        name,
        pairs: activePairs,
        format,
        hasGrandFinalReset,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments', groupId] });
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: ['sessionTournaments', sessionId] });
      }
      toast.success(`Doubles tournament "${created.name}" created!`);
      onClose();
      navigate(`/tournaments/${created.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Could not create tournament');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a tournament name.');
      return;
    }
    if (activePairs.length < 2) {
      toast.error('Add at least 2 doubles pairs to generate a bracket.');
      return;
    }
    createMutation.mutate();
  }

  const estimatedMatches =
    activePairs.length >= 2
      ? format === 'double_elimination'
        ? activePairs.length * 2 - 2
        : activePairs.length - 1
      : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="New Doubles Tournament"
      description="Choose a knockout format and enter doubles pairs. Existing group members link automatically, and new names join as Guests."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Tournament name" htmlFor="tournament-name">
          <Input
            id="tournament-name"
            placeholder="e.g. Sunday Doubles Knockout"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>

        {/* Tournament Format Selector */}
        <div className="space-y-2">
          <span className="block text-sm font-bold text-foreground">
            Tournament format
          </span>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {(
              [
                {
                  value: 'single_elimination' as const,
                  title: 'Single Elimination',
                  subtitle: 'Classic knockout — 1 loss eliminates a pair',
                  icon: Trophy,
                },
                {
                  value: 'double_elimination' as const,
                  title: 'Double Elimination',
                  subtitle: 'Upper & Lower brackets — 2 losses to eliminate',
                  icon: Swords,
                },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const selected = format === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormat(opt.value)}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-left transition-all',
                    selected
                      ? 'border-brand bg-brand-soft/45 ring-2 ring-brand shadow-soft'
                      : 'border-border bg-card hover:bg-muted/50'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl',
                      selected
                        ? 'bg-brand text-ink'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-foreground">
                      {opt.title}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                      {opt.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {format === 'double_elimination' && (
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-xl bg-butter-soft text-butter-strong">
                  <RotateCcw className="size-3.5" />
                </span>
                <div>
                  <p className="text-xs font-extrabold text-foreground">
                    Grand Finals Reset
                  </p>
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    If the Losers Bracket winner wins Grand Final Game 1, a decisive Game 2 is played.
                  </p>
                </div>
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

        <div className="flex items-center justify-between gap-2">
          <Tabs<EntryMode>
            label="Pair input mode"
            value={mode}
            onChange={handleModeChange}
            options={[
              { value: 'list', label: 'Paste / Type List', count: parsedFromText.length },
              {
                value: 'rows',
                label: 'Seed & Pair Editor',
                count: mode === 'rows' ? customPairs.length : parsedFromText.length,
              },
            ]}
          />

          {activePairs.length >= 2 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={shuffleSeeds}
              className="h-8 px-2.5 text-xs"
            >
              <Shuffle className="size-3.5" />
              Shuffle
            </Button>
          )}
        </div>

        {mode === 'list' ? (
          <div className="space-y-2.5">
            <Field
              label="Doubles pairs list"
              htmlFor="doubles-list-input"
              hint="One pair per line (Player A & Player B)"
            >
              <Textarea
                id="doubles-list-input"
                rows={5}
                placeholder={`Gavin & Karyna\nJason / Miracle\nWillas + Bruno Mars\nTheo cwk, Theo cwk`}
                value={listText}
                onChange={(e) => setListText(e.target.value)}
              />
            </Field>

            {sortedMembers.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground">
                  Quick-insert group member (or type any Guest name above; members can join 2+ teams):
                </p>
                <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto rounded-xl border border-border bg-muted/40 p-1.5">
                  {sortedMembers.map((m) => {
                    const isAssigned = assignedMemberIds.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => appendNameToList(m.name)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-card px-2 py-0.5 text-xs font-bold text-foreground shadow-soft hover:bg-brand-soft hover:text-brand-strong"
                      >
                        <span>
                          + {m.name}
                          {isAssigned ? ' (2x)' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <Field label="Player 1 (Member or Guest)" htmlFor="draft-p1">
                <Input
                  id="draft-p1"
                  list="group-member-suggestions"
                  placeholder="e.g. Gavin"
                  value={draftP1}
                  onChange={(e) => setDraftP1(e.target.value)}
                />
              </Field>
              <Field label="Player 2 (Member or Guest)" htmlFor="draft-p2">
                <Input
                  id="draft-p2"
                  list="group-member-suggestions"
                  placeholder="e.g. Guest Alex"
                  value={draftP2}
                  onChange={(e) => setDraftP2(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addRowPair();
                    }
                  }}
                />
              </Field>
              <Button type="button" variant="secondary" onClick={addRowPair}>
                <Plus />
                Add
              </Button>
            </div>

            <datalist id="group-member-suggestions">
              {sortedMembers.map((m) => (
                <option key={m.id} value={m.name} />
              ))}
            </datalist>
          </div>
        )}

        {/* Live parsed doubles pairs & Guest/Member preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Users className="size-3.5" />
              Seeded Doubles Teams ({activePairs.length})
            </span>
            {activePairs.length >= 2 && (
              <span className="text-brand-strong">
                {format === 'double_elimination' ? 'Double Elim' : 'Single Elim'} ·{' '}
                {bracketSize}-slot bracket
                {byeCount > 0 ? ` · ${byeCount} R1 BYE${byeCount === 1 ? '' : 's'}` : ''}
              </span>
            )}
          </div>

          {activePairs.length >= 2 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-butter-soft px-3 py-1.5 text-xs font-bold text-butter-strong">
              <Sparkles className="size-3.5 shrink-0" />
              <span>
                {activePairs.length} pairs →{' '}
                {format === 'double_elimination'
                  ? `${estimatedMatches}${hasGrandFinalReset ? `–${estimatedMatches + 1}` : ''} matches (Upper, Lower & Grand Final)`
                  : `${estimatedMatches} matches`}
                {byeCount > 0
                  ? ` · Top ${byeCount} seeded pair${byeCount === 1 ? '' : 's'} advance by BYE`
                  : ' · Full bracket (no BYEs)'}
              </span>
            </div>
          )}

          {activePairs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
              Type or paste at least 2 doubles pairs above (e.g. &ldquo;Alex &amp; Sam&rdquo;).
            </p>
          ) : (
            <div className="max-h-44 overflow-y-auto rounded-2xl border border-border bg-card p-2 space-y-1.5">
              {activePairs.map((pair, idx) => {
                const m1 = pair.player1MemberId
                  ? memberById.get(pair.player1MemberId)
                  : null;
                const m2 = pair.player2MemberId
                  ? memberById.get(pair.player2MemberId)
                  : null;
                const getsBye = byeCount > 0 && idx < byeCount;
                const hasMe =
                  Boolean(myMemberId) &&
                  (pair.player1MemberId === myMemberId ||
                    pair.player2MemberId === myMemberId);
                const p1Key = getPlayerIdentityKey(pair.player1Name, pair.player1MemberId);
                const p2Key = getPlayerIdentityKey(pair.player2Name, pair.player2MemberId);
                const hasMultiTeamPlayer =
                  (p1Key ? (playerTeamCounts.get(p1Key) ?? 0) >= 2 : false) ||
                  (p2Key ? (playerTeamCounts.get(p2Key) ?? 0) >= 2 : false);

                return (
                  <div
                    key={pair.key}
                    className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-2.5 py-1.5 text-xs"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft font-extrabold text-brand-strong">
                        {idx + 1}
                      </span>

                      <div className="flex -space-x-1.5 shrink-0">
                        <Avatar
                          name={pair.player1Name}
                          emoji={m1?.emoji}
                          color={m1?.color}
                          compact
                          className="size-6 text-[10px]"
                        />
                        <Avatar
                          name={pair.player2Name}
                          emoji={m2?.emoji}
                          color={m2?.color}
                          compact
                          className="size-6 text-[10px]"
                        />
                      </div>

                      {mode === 'rows' ? (
                        <div className="flex flex-1 flex-col gap-1">
                          <div className="grid grid-cols-2 gap-1.5">
                            <Input
                              value={pair.player1Name}
                              list="group-member-suggestions"
                              onChange={(e) =>
                                updateRowPlayer(idx, 1, e.target.value)
                              }
                              className="h-7 px-2 text-xs"
                            />
                            <Input
                              value={pair.player2Name}
                              list="group-member-suggestions"
                              onChange={(e) =>
                                updateRowPlayer(idx, 2, e.target.value)
                              }
                              className="h-7 px-2 text-xs"
                            />
                          </div>
                          {hasMultiTeamPlayer && (
                            <div className="flex items-center gap-1">
                              <Badge variant="butter" className="px-1.5 py-0 text-[10px]">
                                2x Team
                              </Badge>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex min-w-0 flex-wrap items-center gap-1">
                          <span className="truncate font-extrabold">
                            {pair.player1Name}
                          </span>
                          {!m1 && (
                            <Badge variant="butter" className="px-1.5 py-0 text-[10px]">
                              Guest
                            </Badge>
                          )}
                          <span className="text-muted-foreground">&amp;</span>
                          <span className="truncate font-extrabold">
                            {pair.player2Name}
                          </span>
                          {!m2 && (
                            <Badge variant="butter" className="px-1.5 py-0 text-[10px]">
                              Guest
                            </Badge>
                          )}
                          {hasMultiTeamPlayer && (
                            <Badge variant="butter" className="px-1.5 py-0 text-[10px]">
                              2x Team
                            </Badge>
                          )}
                          {hasMe && (
                            <Badge variant="brand" className="px-1.5 py-0 text-[10px]">
                              You
                            </Badge>
                          )}
                          {getsBye && (
                            <Badge variant="lime" className="px-1.5 py-0 text-[10px]">
                              R1 BYE
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSeed(idx, -1)}
                        aria-label="Move seed up"
                        className="cursor-pointer rounded-lg p-1 hover:bg-card disabled:opacity-30"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === activePairs.length - 1}
                        onClick={() => moveSeed(idx, 1)}
                        aria-label="Move seed down"
                        className="cursor-pointer rounded-lg p-1 hover:bg-card disabled:opacity-30"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePair(idx)}
                        aria-label="Remove pair"
                        className="cursor-pointer rounded-lg p-1 text-coral-strong hover:bg-coral-soft"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              createMutation.isPending || activePairs.length < 2 || !name.trim()
            }
          >
            <Trophy className="size-4" />
            {createMutation.isPending ? 'Creating…' : 'Create Doubles Bracket'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
