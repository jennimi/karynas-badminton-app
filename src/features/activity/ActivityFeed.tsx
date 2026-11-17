import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ExternalLink,
  MapPin,
  Settings,
  Swords,
  Trophy,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../shared/lib/cn';
import { Alert } from '../../shared/ui/alert';
import { Avatar, avatarTones } from '../../shared/ui/avatar';
import { Button } from '../../shared/ui/button';
import { Skeleton } from '../../shared/ui/skeleton';
import { addDays, formatCost, formatDate, todayString } from '../../shared/utils/format';
import { getMembers } from '../members/api';
import { AdminDialog } from '../payments/components/AdminDialog';
import { useAdmin } from '../payments/useAdmin';
import { getActivity, type ActivityEntity, type ActivityFilter, type ActivityRow } from './api';

const ENTITY: Record<ActivityEntity, { icon: LucideIcon; tone: keyof typeof avatarTones; label: string }> = {
  session: { icon: CalendarDays, tone: 'brand', label: 'Session' },
  participant: { icon: Users, tone: 'brand', label: 'Players' },
  payment: { icon: Wallet, tone: 'lime', label: 'Payment' },
  member: { icon: UserRound, tone: 'coral', label: 'Member' },
  match: { icon: Swords, tone: 'butter', label: 'Match' },
  tournament: { icon: Trophy, tone: 'butter', label: 'Tournament' },
  venue: { icon: MapPin, tone: 'coral', label: 'Venue' },
  setting: { icon: Settings, tone: 'brand', label: 'Setting' },
};

// ---------- bursts ----------
// Resetting 32 payments writes 32 log lines. Shown as separate lines that is noise, so lines of
// the same kind, by the same person, for the same session, within two minutes become one.

export type FeedItem = { kind: 'one'; row: ActivityRow } | { kind: 'burst'; rows: ActivityRow[] };

const burstKey = (r: ActivityRow) =>
  r.entity === 'participant' || (r.entity === 'payment' && r.action === 'status')
    ? [r.entity, r.action, r.actor_member_id ?? '-', r.session_id ?? '-', String(r.details.to ?? '')].join('|')
    : null;

export function groupBursts(rows: ActivityRow[]): FeedItem[] {
  const out: FeedItem[] = [];
  for (const r of rows) {
    const last = out.at(-1);
    const key = burstKey(r);
    if (key && last) {
      const prev = last.kind === 'one' ? last.row : last.rows.at(-1)!;
      if (burstKey(prev) === key && Math.abs(+new Date(prev.at) - +new Date(r.at)) <= 120_000) {
        if (last.kind === 'one') out[out.length - 1] = { kind: 'burst', rows: [last.row, r] };
        else last.rows.push(r);
        continue;
      }
    }
    out.push({ kind: 'one', row: r });
  }
  return out;
}

function burstText(rows: ActivityRow[]): string {
  const r = rows[0];
  const n = rows.length;
  const day = r.details.date ? formatDate(String(r.details.date)) : null;
  if (r.entity === 'participant') {
    return r.action === 'added'
      ? `${n} people joined${day ? ` the ${day} session` : ''}`
      : `Removed ${n} people${day ? ` from the ${day} session` : ''}`;
  }
  const when = day ? ` (${day} session)` : '';
  return r.details.to === 'approved'
    ? `Approved ${n} payments${when}`
    : r.details.to === 'pending'
      ? `${n} people marked as paid, waiting approval${when}`
      : `Reset ${n} payments to not paid${when}`;
}

// ---------- one line ----------

const time = (at: string) => new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Where the line points to, if that thing still exists. */
function linkFor(r: ActivityRow): string | null {
  if (r.action === 'deleted') return null;
  if (r.session_id) return `/sessions/${r.session_id}${r.entity === 'payment' ? '?tab=payments' : ''}`;
  if (r.entity === 'member' && r.member_id) return `/members/${r.member_id}`;
  return null;
}

function Who({ row, members }: { row: ActivityRow; members: Awaited<ReturnType<typeof getMembers>> }) {
  const actor = members.find((m) => m.id === row.actor_member_id);
  if (!row.actor_member_id || !row.actor_name) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserRound className="size-3" />
        </span>
        Someone
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Avatar
        name={row.actor_name}
        emoji={actor?.emoji}
        color={actor?.color}
        className="size-5 text-[9px] ring-0"
        compact
      />
      {row.actor_name}
    </span>
  );
}

function Entry({
  row,
  rows,
  members,
  compact,
}: {
  row: ActivityRow;
  /** more than one when this line is a burst */
  rows?: ActivityRow[];
  members: Awaited<ReturnType<typeof getMembers>>;
  compact?: boolean;
}) {
  const meta = ENTITY[row.entity] ?? ENTITY.setting;
  const Icon = meta.icon;
  const burst = rows && rows.length > 1 ? rows : null;
  const cost =
    row.action === 'cost' && typeof row.details.to === 'number'
      ? `${typeof row.details.from === 'number' ? formatCost(row.details.from) : 'no cost'} → ${formatCost(row.details.to)}`
      : null;
  const href = linkFor(row);

  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl', avatarTones[meta.tone])} title={meta.label}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{burst ? burstText(burst) : row.summary}</p>
        {cost && <p className="mt-0.5 text-xs font-bold text-lime-strong">{cost}</p>}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <Who row={row} members={members} />
          <span title={new Date(row.at).toLocaleString('en-GB')}>
            · {compact ? `${formatDate(row.at.slice(0, 10)).replace(/, \d{4}$/, '')} ` : ''}
            {time(row.at)}
          </span>
        </p>
        {burst && (
          <details className="mt-1 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-bold">Show who</summary>
            <p className="mt-1">{burst.map((r) => r.details.member ?? '?').join(', ')}</p>
          </details>
        )}
      </div>
      {href && (
        <Link
          to={href}
          aria-label="Open"
          className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ExternalLink className="size-4" />
        </Link>
      )}
    </li>
  );
}

// ---------- the feed ----------

const dayLabel = (at: string) => {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = todayString();
  return local === today ? 'Today' : local === addDays(today, -1) ? 'Yesterday' : formatDate(local);
};

/**
 * The newest changes first, grouped by day. Used on the Activity page, the dashboard, a session
 * and a member's page: pass `sessionId` / `memberId` / `entities` / `actorId` to narrow it down.
 */
export function ActivityFeed({
  compact,
  loadMore,
  pageSize = 50,
  ...filter
}: Omit<ActivityFilter, 'limit'> & { compact?: boolean; loadMore?: boolean; pageSize?: number }) {
  const [limit, setLimit] = useState(pageSize);
  const admin = useAdmin(filter.groupId);
  const [unlocking, setUnlocking] = useState(false);
  const { data: members = [] } = useQuery({
    queryKey: ['members', filter.groupId],
    queryFn: () => getMembers(filter.groupId),
  });
  const { data: rows, isLoading, error } = useQuery({
    // the passcode is not part of the key; being admin is
    queryKey: ['activity', filter, limit, admin.isAdmin],
    queryFn: () => getActivity({ ...filter, limit }, admin.code!),
    enabled: admin.isAdmin,
    // new entries show up when someone comes back to the tab
    refetchOnWindowFocus: true,
    staleTime: 15_000,
    retry: false,
  });

  // the log is private: without admin mode there is nothing to show
  if (!admin.isAdmin) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-6 text-center">
        <Lock className="size-5 text-muted-foreground" />
        <p className="text-sm font-bold">The activity log is private</p>
        <p className="text-xs text-muted-foreground">Only the admin can see who changed what.</p>
        <Button size="sm" variant="outline" onClick={() => setUnlocking(true)}>
          Unlock admin mode
        </Button>
        {unlocking && <AdminDialog groupId={filter.groupId} onClose={() => setUnlocking(false)} />}
      </div>
    );
  }
  if (error) {
    // a wrong or expired passcode: lock again so it can be re-entered
    if (/only the admin/i.test((error as Error).message)) admin.lock();
    return (
      <Alert>
        <p>{(error as Error).message}</p>
      </Alert>
    );
  }
  if (isLoading || !rows) return <Skeleton className="h-24" />;
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nothing logged yet.</p>;
  }

  // split into days, then collapse bursts inside each day
  const days: { label: string; items: FeedItem[] }[] = [];
  for (const r of rows) {
    const label = dayLabel(r.at);
    const last = days.at(-1);
    if (last?.label === label) last.items.push({ kind: 'one', row: r });
    else days.push({ label, items: [{ kind: 'one', row: r }] });
  }
  for (const d of days) d.items = groupBursts(d.items.map((i) => (i as { kind: 'one'; row: ActivityRow }).row));

  return (
    <div className="space-y-4">
      {days.map((d) => (
        <section key={d.label} aria-label={d.label}>
          {!compact && <h3 className="mb-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{d.label}</h3>}
          <ul className="divide-y divide-border">
            {d.items.map((item) =>
              item.kind === 'one' ? (
                <Entry key={item.row.id} row={item.row} members={members} compact={compact} />
              ) : (
                <Entry key={item.rows[0].id} row={item.rows[0]} rows={item.rows} members={members} compact={compact} />
              ),
            )}
          </ul>
        </section>
      ))}
      {loadMore && rows.length >= limit && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + pageSize)}>
            Show older
          </Button>
        </div>
      )}
    </div>
  );
}
