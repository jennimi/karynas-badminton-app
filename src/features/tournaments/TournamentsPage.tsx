import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronRight, Plus, Trophy, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import { Avatar } from '../../shared/ui/avatar';
import { Badge } from '../../shared/ui/badge';
import { Button } from '../../shared/ui/button';
import { Card } from '../../shared/ui/card';
import { Skeleton } from '../../shared/ui/skeleton';
import { Tabs } from '../../shared/ui/tabs';
import { formatDate } from '../../shared/utils/format';
import { useCurrentGroup } from '../groups/hooks';
import { getTournaments } from './api';
import { formatPairName } from './bracket';
import { CreateTournamentDialog } from './components/CreateTournamentDialog';
import type { TournamentStatus, TournamentSummary } from './types';

type FilterTab = 'all' | 'in_progress' | 'completed';

const statusBadgeConfig: Record<
  TournamentStatus,
  { label: string; variant: 'neutral' | 'butter' | 'lime' }
> = {
  draft: { label: 'Draft', variant: 'neutral' },
  in_progress: { label: 'In Progress', variant: 'butter' },
  completed: { label: 'Completed', variant: 'lime' },
};

export default function TournamentsPage() {
  const { data: group } = useCurrentGroup();
  const [tab, setTab] = useState<FilterTab>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments', group?.id],
    queryFn: () => getTournaments(group!.id),
    enabled: Boolean(group?.id),
  });

  const counts = useMemo(
    () => ({
      all: tournaments.length,
      in_progress: tournaments.filter((t) => t.status !== 'completed').length,
      completed: tournaments.filter((t) => t.status === 'completed').length,
    }),
    [tournaments]
  );

  const filtered = useMemo(() => {
    if (tab === 'in_progress') {
      return tournaments.filter((t) => t.status !== 'completed');
    }
    if (tab === 'completed') {
      return tournaments.filter((t) => t.status === 'completed');
    }
    return tournaments;
  }, [tournaments, tab]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tournaments"
        description="Doubles knockout brackets with list entry, Guests, and instant winner selection."
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={!group}>
            <Plus />
            New Tournament
          </Button>
        }
      />

      {tournaments.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs<FilterTab>
            label="Filter tournaments"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'in_progress', label: 'Active', count: counts.in_progress },
              { value: 'completed', label: 'Completed', count: counts.completed },
            ]}
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            emoji="🏆"
            title={
              tournaments.length === 0
                ? 'No doubles tournaments yet'
                : 'No matching tournaments'
            }
            description={
              tournaments.length === 0
                ? 'Paste a list of doubles pairs (group members or Guests) to generate a knockout bracket.'
                : 'Switch tabs above to view other tournaments.'
            }
            action={
              tournaments.length === 0 && group ? (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus />
                  New Tournament
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((tournament) => (
            <TournamentListCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      )}

      {createOpen && group && (
        <CreateTournamentDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          groupId={group.id}
        />
      )}
    </div>
  );
}

function TournamentListCard({ tournament }: { tournament: TournamentSummary }) {
  const statusInfo = statusBadgeConfig[tournament.status] ?? statusBadgeConfig.draft;
  const dateOnly = tournament.created_at.slice(0, 10);
  const champion = tournament.champion_pair;

  return (
    <Link to={`/tournaments/${tournament.id}`} className="block group">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5 transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-brand">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
            <Trophy className="size-6" />
          </span>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-extrabold">{tournament.name}</h2>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              <Badge
                variant={
                  tournament.format === 'double_elimination' ? 'brand' : 'neutral'
                }
              >
                {tournament.format === 'double_elimination'
                  ? 'Double Elim'
                  : 'Single Elim'}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" />
                {tournament.participant_count} doubles pairs
              </span>
              <span>
                {tournament.completed_match_count}/{tournament.match_count} matches decided
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" />
                {formatDate(dateOnly)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {champion && (
            <div className="flex items-center gap-2 rounded-full bg-lime-soft px-3 py-1 text-xs font-extrabold text-lime-strong">
              <Trophy className="size-3.5" />
              <div className="flex -space-x-1.5">
                <Avatar
                  name={champion.player1_name}
                  emoji={champion.member?.emoji}
                  color={champion.member?.color}
                  compact
                  className="size-5 text-[9px]"
                />
                <Avatar
                  name={champion.player2_name}
                  emoji={champion.partner?.emoji}
                  color={champion.partner?.color}
                  compact
                  className="size-5 text-[9px]"
                />
              </div>
              <span>{formatPairName(champion)}</span>
            </div>
          )}
          <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  );
}
