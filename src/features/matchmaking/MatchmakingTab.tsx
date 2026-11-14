import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Swords, Trash2, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { cn } from '../../shared/lib/cn';
import type { SessionWithParticipants } from '../../shared/types';
import { Alert } from '../../shared/ui/alert';
import { Avatar } from '../../shared/ui/avatar';
import { Badge } from '../../shared/ui/badge';
import { Button } from '../../shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { Skeleton } from '../../shared/ui/skeleton';
import { useAdmin } from '../payments/useAdmin';
import { createMatch, deleteMatch, getMatches, updateMatch } from './api';
import { MatchDialog } from './components/MatchDialog';
import type { MatchInput, MatchWithPlayers, Team } from './types';

/** One side of a match: avatars + names, highlighted when they won. */
function Side({ match, team, won, align }: { match: MatchWithPlayers; team: Team; won: boolean; align: 'left' | 'right' }) {
  const players = match.players.filter((p) => p.team === team);
  return (
    <div className={cn('flex min-w-0 items-center gap-2', align === 'right' && 'flex-row-reverse text-right')}>
      <div className="flex shrink-0 -space-x-2">
        {players.map((p) => (
          <Avatar key={p.id} name={p.member.name} className="size-8 ring-2 ring-card" />
        ))}
      </div>
      <div className="min-w-0">
        <p className={cn('text-sm leading-tight', won ? 'font-extrabold' : 'font-semibold')}>
          {players.map((p) => p.member.name).join(' & ') || '—'}
        </p>
        {won && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-lime-strong">
            <Trophy className="size-3" /> Won
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Matches played in a session: the list, plus a pop-up to add or edit one
 * (who played whom, and the score). Shown on the session page.
 */
export default function MatchmakingTab({ session }: { session: SessionWithParticipants }) {
  const queryClient = useQueryClient();
  const admin = useAdmin(session.group_id);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MatchWithPlayers | null>(null);
  const [removing, setRemoving] = useState<MatchWithPlayers | null>(null);

  const key = ['matches', session.id];
  const { data: matches = [], isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => getMatches(session.id),
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const players = useMemo(
    () => session.participants.map((p) => p.member).sort((a, b) => a.name.localeCompare(b.name)),
    [session.participants]
  );
  const gamesPlayed = useMemo(() => {
    const count = new Map<string, number>();
    for (const m of matches) for (const p of m.players) count.set(p.member_id, (count.get(p.member_id) ?? 0) + 1);
    return count;
  }, [matches]);

  const saveMutation = useMutation({
    mutationFn: ({ input, match }: { input: MatchInput; match?: MatchWithPlayers }) =>
      match
        ? updateMatch(match.id, input)
        : createMatch(session.id, matches.reduce((n, m) => Math.max(n, m.round), 0) + 1, input),
    onSuccess: refresh,
  });
  const deleteMutation = useMutation({
    mutationFn: (m: MatchWithPlayers) => deleteMatch(m.id, admin.code!),
    onSuccess: () => {
      refresh();
      setRemoving(null);
      toast.success('Match removed');
    },
    onError: (e: Error) => {
      if (/passcode|only the admin/i.test(e.message)) admin.lock();
      toast.error(e.message);
    },
  });

  const save = async (input: MatchInput, another: boolean) => {
    await saveMutation.mutateAsync({ input, match: editing ?? undefined });
    toast.success(editing ? 'Match updated' : 'Match added 🏸');
    if (!another) {
      setAdding(false);
      setEditing(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <CardTitle className="flex items-center gap-2">
          Matches <Badge variant="brand">{matches.length}</Badge>
        </CardTitle>
        <Button size="sm" onClick={() => setAdding(true)} disabled={!!error}>
          <Plus /> Add match
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <Alert>
            <p>{(error as Error).message}</p>
          </Alert>
        ) : isLoading ? (
          <Skeleton className="h-16" />
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">
            <Swords className="size-6" />
            <p className="font-bold">No matches yet</p>
            <p className="text-sm">Add who played whom and the score as the games finish.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {matches.map((m) => {
              const done = m.score_a != null && m.score_b != null;
              const winner: Team | null = done && m.score_a !== m.score_b ? (m.score_a! > m.score_b! ? 'A' : 'B') : null;
              return (
                <li key={m.id} className="rounded-2xl border border-border p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <span>Game {m.round}</span>
                    {m.court != null && <span>· Court {m.court}</span>}
                    {!done && <Badge variant="butter">No score yet</Badge>}
                    <span className="ml-auto flex">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={`Edit game ${m.round}`}
                        onClick={() => setEditing(m)}
                      >
                        <Pencil />
                      </Button>
                      {admin.isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 hover:bg-coral-soft hover:text-coral-strong"
                        aria-label={`Remove game ${m.round}`}
                        onClick={() => setRemoving(m)}
                      >
                        <Trash2 />
                      </Button>
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <Side match={m} team="A" won={winner === 'A'} align="left" />
                    <div className="flex items-center gap-1.5 text-xl font-extrabold tabular-nums">
                      <span className={cn(winner === 'B' && 'text-muted-foreground')}>{m.score_a ?? '–'}</span>
                      <span className="text-sm text-muted-foreground">:</span>
                      <span className={cn(winner === 'A' && 'text-muted-foreground')}>{m.score_b ?? '–'}</span>
                    </div>
                    <Side match={m} team="B" won={winner === 'B'} align="right" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {/* remount per match so the pop-up starts from that match's values */}
      {(adding || editing) && (
        <MatchDialog
          key={editing?.id ?? 'new'}
          players={players}
          gamesPlayed={gamesPlayed}
          courts={session.courts}
          match={editing ?? undefined}
          saving={saveMutation.isPending}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={save}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && deleteMutation.mutate(removing)}
        isLoading={deleteMutation.isPending}
        title={`Remove game ${removing?.round ?? ''}?`}
        description="The match and its score will be deleted. Players and the session are not affected."
        confirmLabel="Remove match"
      />
    </Card>
  );
}
