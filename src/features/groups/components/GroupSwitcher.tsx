import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '../../../shared/ui/skeleton';
import { getGroups } from '../api';
import { useCurrentGroup } from '../hooks';

/** Sidebar card showing the current group; links to its page. */
export function GroupSwitcher() {
  const { data: group, isLoading } = useCurrentGroup();
  const { data: groups = [] } = useQuery({ queryKey: ['groups'], queryFn: getGroups });

  if (isLoading || !group) return <Skeleton className="h-14" />;
  const count = groups.find((g) => g.id === group.id)?.member_count;

  return (
    <Link
      to={`/groups/${group.id}`}
      className="flex items-center gap-3 rounded-control border border-border bg-background p-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lime-soft text-lg">
        {group.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold">{group.name}</span>
        {count !== undefined && (
          <span className="block text-xs text-muted-foreground">{count} members</span>
        )}
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  );
}
