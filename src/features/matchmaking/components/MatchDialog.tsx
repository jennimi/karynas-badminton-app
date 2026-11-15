import { Search, Shuffle, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { cn } from '../../../shared/lib/cn';
import type { Member } from '../../../shared/types';
import { Avatar } from '../../../shared/ui/avatar';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { Input } from '../../../shared/ui/input';
import type { MatchInput, MatchWithPlayers, Team } from '../types';

interface Props {
  /** The people playing in this session: the only ones you can pick. */
  players: Member[];
  /** Games each person has already played this session (to help rotate fairly). */
  gamesPlayed: Map<string, number>;
  /** How many courts the session has booked (for the court picker), if known. */
  courts: number | null;
  /** Pass a match to edit it; leave out to add a new one. */
  match?: MatchWithPlayers;
  saving: boolean;
  onClose: () => void;
  /** `another` = keep the pop-up open for the next game. */
  onSave: (input: MatchInput, another: boolean) => Promise<void>;
}

const MAX_PER_TEAM = 2;
const teamStyle: Record<Team, { box: string; chip: string; label: string }> = {
  A: { box: 'border-brand bg-brand-soft', chip: 'bg-brand text-ink', label: 'Team A' },
  B: { box: 'border-lime bg-lime-soft', chip: 'bg-lime text-ink', label: 'Team B' },
};

/**
 * Pop-up to add or edit one match. Tap a team box, then tap players to put them in it
 * (it moves on to the other team by itself when one is full). Two a side = doubles,
 * one a side = singles. The score can be left empty and added later.
 */
export function MatchDialog({ players, gamesPlayed, courts, match, saving, onClose, onSave }: Props) {
  const initial = (team: Team) => match?.players.filter((p) => p.team === team).map((p) => p.member_id) ?? [];
  const [teams, setTeams] = useState<Record<Team, string[]>>({ A: initial('A'), B: initial('B') });
  const [active, setActive] = useState<Team>('A');
  const [scoreA, setScoreA] = useState(match?.score_a != null ? String(match.score_a) : '');
  const [scoreB, setScoreB] = useState(match?.score_b != null ? String(match.score_b) : '');
  const [court, setCourt] = useState(match?.court != null ? String(match.court) : '');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const nameOf = useMemo(() => {
    const map = new Map(players.map((p) => [p.id, p.name]));
    // members picked for an old match may have left the session: still show their names
    for (const p of match?.players ?? []) if (!map.has(p.member_id)) map.set(p.member_id, p.member.name);
    return map;
  }, [players, match]);

  const teamOf = (id: string): Team | null => (teams.A.includes(id) ? 'A' : teams.B.includes(id) ? 'B' : null);
  const other = (t: Team): Team => (t === 'A' ? 'B' : 'A');

  const toggle = (id: string) => {
    setError('');
    const current = teamOf(id);
    if (current) {
      // tap a chosen player again to take them out; the next pick goes back into that gap
      setTeams((t) => ({ ...t, [current]: t[current].filter((x) => x !== id) }));
      setActive(current);
      return;
    }
    const target = teams[active].length < MAX_PER_TEAM ? active : other(active);
    if (teams[target].length >= MAX_PER_TEAM) {
      setError('Both teams are full. Tap a player in a team to take them out first.');
      return;
    }
    const next = [...teams[target], id];
    setTeams((t) => ({ ...t, [target]: next }));
    // move on to the other team once this one is full
    setActive(next.length >= MAX_PER_TEAM && teams[other(target)].length < MAX_PER_TEAM ? other(target) : target);
  };

  const shuffle = () => {
    const all = [...teams.A, ...teams.B];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const half = Math.ceil(all.length / 2);
    setTeams({ A: all.slice(0, half), B: all.slice(half) });
  };

  const reset = () => {
    setTeams({ A: [], B: [] });
    setActive('A');
    setScoreA('');
    setScoreB('');
    setError('');
  };

  const toScore = (v: string) => (v.trim() === '' ? null : Number(v));
  const a = toScore(scoreA);
  const b = toScore(scoreB);
  const problem =
    teams.A.length === 0 || teams.B.length === 0
      ? 'Pick at least one player for each team.'
      : teams.A.length !== teams.B.length
        ? 'Both teams need the same number of players (1 v 1 or 2 v 2).'
        : (a === null) !== (b === null)
          ? 'Enter both scores, or leave both empty to add them later.'
          : (a !== null && !(a >= 0 && Number.isInteger(a))) || (b !== null && !(b >= 0 && Number.isInteger(b)))
            ? 'Scores must be whole numbers.'
            : '';

  const submit = async (another: boolean) => {
    if (problem) {
      setError(problem);
      return;
    }
    try {
      await onSave({ court: court ? Number(court) : null, teamA: teams.A, teamB: teams.B, score_a: a, score_b: b }, another);
      if (another) reset();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const shown = players
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    // fewest games first, so people who have been waiting are easy to find
    .sort((x, y) => (gamesPlayed.get(x.id) ?? 0) - (gamesPlayed.get(y.id) ?? 0) || x.name.localeCompare(y.name));

  // a render helper, not a component: a nested component would remount (and drop focus) on every keystroke
  const teamBox = (team: Team, score: string, setScore: (v: string) => void) => {
    const s = teamStyle[team];
    const isActive = active === team;
    return (
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border-2 p-2.5 transition-colors sm:p-3',
          isActive ? s.box : 'border-border bg-muted/40'
        )}
      >
        <button
          type="button"
          onClick={() => setActive(team)}
          aria-pressed={isActive}
          className="flex items-center justify-between text-left text-xs font-extrabold uppercase tracking-wider"
        >
          {s.label}
          <span className="hidden font-bold normal-case tracking-normal text-muted-foreground sm:inline">
            {isActive ? 'adding here' : 'tap to add here'}
          </span>
        </button>
        <div className="flex min-h-[4.75rem] flex-col gap-1.5">
          {teams[team].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              aria-label={`Remove ${nameOf.get(id)} from ${s.label}`}
              className={cn('flex items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm font-bold', s.chip)}
            >
              <Avatar name={nameOf.get(id) ?? '?'} className="size-6 text-[10px]" compact />
              <span className="min-w-0 flex-1 truncate">{nameOf.get(id)}</span>
              <X className="size-3.5 shrink-0" />
            </button>
          ))}
          {Array.from({ length: MAX_PER_TEAM - teams[team].length }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(team)}
              className="rounded-xl border border-dashed border-border px-2 py-1.5 text-left text-sm text-muted-foreground"
            >
              {teams[team].length + i === 0 ? 'Pick a player' : 'Partner'}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-2 text-xs font-bold">
          Score
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            step={1}
            placeholder="–"
            aria-label={`${s.label} score`}
            className="h-11 w-20 text-center text-lg font-extrabold"
            value={score}
            onChange={(e) => setScore(e.target.value.replace(/\D/g, '').slice(0, 2))}
          />
        </label>
      </div>
    );
  };

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={match ? `Edit game ${match.round}` : 'Add a match'}
    >
      <form
        className="space-y-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <div className="flex items-stretch gap-1.5 sm:gap-2">
          {teamBox('A', scoreA, setScoreA)}
          <div className="flex flex-col items-center justify-center gap-2">
            <span className="text-xs font-extrabold text-muted-foreground">VS</span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Shuffle the pairs"
              title="Shuffle the pairs"
              disabled={teams.A.length + teams.B.length < 3}
              onClick={shuffle}
            >
              <Shuffle />
            </Button>
          </div>
          {teamBox('B', scoreB, setScoreB)}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-extrabold">Players in this session</p>
            {players.length > 8 && (
              <div className="relative w-44">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search players"
                  placeholder="Search…"
                  className="h-9 pl-8"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}
          </div>
          {players.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              This session has no participants yet. Add them to the session first.
            </p>
          ) : (
            <ul className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
              {shown.map((p) => {
                const t = teamOf(p.id);
                const games = gamesPlayed.get(p.id) ?? 0;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      aria-pressed={!!t}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        t ? cn('border-transparent', teamStyle[t].chip) : 'border-border bg-card hover:bg-muted'
                      )}
                    >
                      <Avatar name={p.name} className="size-6 text-[10px]" compact />
                      {p.name}
                      <span
                        title={t ? teamStyle[t].label : `Games played this session: ${games}`}
                        className={cn(
                          'min-w-5 rounded-md px-1 text-center text-[11px] font-extrabold tabular-nums',
                          t ? 'bg-ink/10' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {t ? teamStyle[t].label.slice(-1) : games}
                        <span className="sr-only">{t ? '' : ' games played'}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {shown.length === 0 && <li className="p-2 text-sm text-muted-foreground">No one matches “{query}”.</li>}
            </ul>
          )}
        </div>

        {courts != null && courts > 1 && (
          <label className="flex items-center gap-2 text-sm font-bold">
            Court
            <select
              value={court}
              onChange={(e) => setCourt(e.target.value)}
              className="h-9 rounded-control border border-border bg-card px-2.5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-ring"
            >
              <option value="">Any</option>
              {Array.from({ length: courts }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && (
          <p role="alert" className="text-sm font-bold text-coral-strong">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {match ? 'Cancel' : 'Close'}
          </Button>
          {!match && (
            <Button variant="secondary" disabled={saving} onClick={() => void submit(true)}>
              Save & add another
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : match ? 'Save changes' : 'Save match'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
