import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, UserRound, UserRoundX } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '../../shared/components/EmptyState';
import { RallyLoader } from '../../shared/components/brand/RallyLoader';
import { cn } from '../../shared/lib/cn';
import type { Member, MemberBill, MemberColor, PaymentStatus } from '../../shared/types';
import { Avatar, avatarTones } from '../../shared/ui/avatar';
import { Badge } from '../../shared/ui/badge';
import { Button, buttonVariants } from '../../shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { Input } from '../../shared/ui/input';
import { formatCost, formatDate, isUpcoming } from '../../shared/utils/format';
import { ActivityFeed } from '../activity/ActivityFeed';
import { useAdmin } from '../payments/useAdmin';
import { MemberStatsCard } from '../stats/components/MemberStatsCard';
import { useSyncCurrentGroup } from '../groups/hooks';
import { EMOJI_CHOICES, memberEmoji } from '../payments/shareMessage';
import { getMember, getMemberBills, getMembers, updateMemberColor, updateMemberEmoji } from './api';
import { MemberTypeBadge } from './components/MemberTypeBadge';
import { useMemberTypes } from './memberType';
import { useMe } from './useMe';

const statusInfo: Record<PaymentStatus, { label: string; variant: 'neutral' | 'butter' | 'lime' }> = {
  unpaid: { label: 'Not paid', variant: 'neutral' },
  pending: { label: 'Paid, waiting approval', variant: 'butter' },
  approved: { label: 'Approved', variant: 'lime' },
};

const HISTORY_PREVIEW = 8;

const COLORS: { value: MemberColor; label: string }[] = [
  { value: 'brand', label: 'Lavender' },
  { value: 'lime', label: 'Lime' },
  { value: 'butter', label: 'Butter' },
  { value: 'coral', label: 'Coral' },
];

/** One session line: date + place on the left, their share and payment status on the right. */
function BillRow({ bill }: { bill: MemberBill }) {
  const { session } = bill;
  const info = statusInfo[bill.payment_status];
  return (
    <li>
      <Link
        to={`/sessions/${session.id}?tab=payments`}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate text-sm font-bold">{session.title || formatDate(session.date)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[session.title ? formatDate(session.date) : null, session.location, isUpcoming(session.date) ? 'upcoming' : null]
              .filter(Boolean)
              .join(' · ') || 'No location'}
          </p>
        </div>
        <span className="text-sm font-extrabold tabular-nums">
          {bill.share != null ? formatCost(bill.share) : <span className="font-semibold text-muted-foreground">No cost yet</span>}
        </span>
        {bill.share != null && <Badge variant={info.variant}>{info.label}</Badge>}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

/** `/members/:id`: one member: who they are, their icon, what they still owe, their sessions. */
export default function MemberProfilePage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [custom, setCustom] = useState('');
  const [showAll, setShowAll] = useState(false);

  const memberQuery = useQuery({ queryKey: ['member', id], queryFn: () => getMember(id), enabled: !!id });
  const member = memberQuery.data;
  useSyncCurrentGroup(member?.group_id);
  const me = useMe(member?.group_id);
  const admin = useAdmin(member?.group_id);
  const isMe = !!member && me.memberId === member.id;

  const { data: members = [] } = useQuery({
    queryKey: ['members', member?.group_id],
    queryFn: () => getMembers(member!.group_id),
    enabled: !!member,
  });
  const type = useMemberTypes(member?.group_id, members).get(id);

  const { data: bills = [], isLoading: billsLoading } = useQuery({
    queryKey: ['memberBills', id],
    queryFn: () => getMemberBills(id),
    enabled: !!member,
  });

  const saved = (next: Member) => {
    queryClient.setQueryData(['member', id], next);
    queryClient.invalidateQueries({ queryKey: ['members'] });
    queryClient.invalidateQueries({ queryKey: ['session'] });
  };
  const emojiMutation = useMutation({
    mutationFn: (emoji: string | null) => updateMemberEmoji(id, emoji),
    onSuccess: (next) => {
      saved(next);
      setCustom('');
      toast.success(next.emoji ? `Icon changed to ${next.emoji}` : 'Back to initials');
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const colorMutation = useMutation({
    mutationFn: (color: MemberColor | null) => updateMemberColor(id, color),
    onSuccess: (next) => {
      saved(next);
      toast.success(next.color ? 'Colour changed' : 'Back to the automatic colour');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (memberQuery.isLoading) return <RallyLoader />;
  if (!member) {
    return (
      <EmptyState
        emoji="🤷"
        title="Member not found"
        description="They may have been removed from the group."
        action={<Link to="/members" className={buttonVariants({ variant: 'outline' })}>Back to members</Link>}
      />
    );
  }

  // owed = a cost is set and it isn't approved yet
  const open = bills.filter((b) => b.share != null && b.payment_status !== 'approved');
  const unpaid = open.filter((b) => b.payment_status === 'unpaid');
  const waiting = open.filter((b) => b.payment_status === 'pending');
  const sum = (list: MemberBill[]) => list.reduce((total, b) => total + (b.share ?? 0), 0);
  const history = showAll ? bills : bills.slice(0, HISTORY_PREVIEW);

  const submitCustom = (e: FormEvent) => {
    e.preventDefault();
    if (custom.trim()) emojiMutation.mutate(custom);
  };

  return (
    <div className="space-y-6">
      <Link to="/members" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-strong hover:underline">
        <ArrowLeft className="size-4" /> Members
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <Avatar name={member.name} emoji={member.emoji} color={member.color} className="size-16 text-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-3xl font-extrabold tracking-tight">{member.name}</h1>
            {isMe && <Badge variant="brand">You</Badge>}
            <MemberTypeBadge result={type} />
          </div>
          {type && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{type.why}</p>}
        </div>
        {isMe ? (
          <Button variant="outline" onClick={me.clear}>
            <UserRoundX /> This isn’t me
          </Button>
        ) : (
          <Button
            onClick={() => {
              me.become(member.id);
              toast.success(`Hi ${member.name} 👋 Remembered until you close this tab.`);
            }}
          >
            <UserRound /> This is me
          </Button>
        )}
      </header>

      <MemberStatsCard memberId={member.id} groupId={member.group_id} />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Unpaid bills</CardTitle>
            {open.length > 0 && <Badge variant="coral">{formatCost(sum(open))} open</Badge>}
          </CardHeader>
          {billsLoading ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">Loading…</p>
            </CardContent>
          ) : open.length === 0 ? (
            <EmptyState emoji="🎉" title="All settled" description={`${member.name} doesn’t owe anything.`} />
          ) : (
            <>
              <p className="px-5 pt-2 text-sm text-muted-foreground">
                {unpaid.length > 0 && `${formatCost(sum(unpaid))} not paid (${unpaid.length})`}
                {unpaid.length > 0 && waiting.length > 0 && ' · '}
                {waiting.length > 0 && `${formatCost(sum(waiting))} paid, waiting for approval (${waiting.length})`}
              </p>
              <ul className="mt-3 divide-y divide-border border-t border-border [&>li:last-child>a]:rounded-b-card">
                {open.map((b) => (
                  <BillRow key={b.participant_id} bill={b} />
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Icon</CardTitle>
            {(member.emoji || member.color) && (
              <Button
                variant="ghost"
                size="sm"
                disabled={emojiMutation.isPending || colorMutation.isPending}
                onClick={() => {
                  if (member.emoji) emojiMutation.mutate(null);
                  if (member.color) colorMutation.mutate(null);
                }}
              >
                Use automatic
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {member.emoji
                ? `${member.emoji} is ${isMe ? 'your' : 'their'} picture in the app, and goes next to ${isMe ? 'your' : 'their'} name in the payment message once the payment is approved.`
                : `Automatic: initials in the app, and ${memberEmoji(member)} in the payment message. Pick an emoji to use it for both.`}
            </p>

            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Background colour">
              <span className="mr-1 text-sm font-bold">Colour</span>
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-label={c.label}
                  title={c.label}
                  aria-pressed={member.color === c.value}
                  disabled={colorMutation.isPending}
                  onClick={() => colorMutation.mutate(c.value)}
                  className={cn(
                    'flex size-10 cursor-pointer items-center justify-center rounded-full border-2 text-xs font-extrabold transition-all hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60',
                    avatarTones[c.value],
                    member.color === c.value ? 'border-foreground' : 'border-transparent'
                  )}
                >
                  {member.color === c.value ? '✓' : ''}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose an emoji">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-label={`Use ${e}`}
                  aria-pressed={member.emoji === e}
                  disabled={emojiMutation.isPending}
                  onClick={() => emojiMutation.mutate(e)}
                  className={cn(
                    'flex size-10 cursor-pointer items-center justify-center rounded-control border text-xl transition-all hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60',
                    member.emoji === e ? 'border-brand bg-brand-soft' : 'border-border bg-card'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <form onSubmit={submitCustom} className="flex items-center gap-2">
              <Input
                aria-label="Another emoji"
                placeholder="Or type another emoji"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                maxLength={16}
              />
              <Button type="submit" variant="secondary" disabled={emojiMutation.isPending || !custom.trim()}>
                Use it
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <span className="text-sm font-semibold text-muted-foreground">{bills.length} joined</span>
        </CardHeader>
        {bills.length === 0 ? (
          <EmptyState emoji="🗓️" title={billsLoading ? 'Loading…' : 'No sessions yet'} />
        ) : (
          <>
            <ul className="mt-3 divide-y divide-border border-t border-border">
              {history.map((b) => (
                <BillRow key={b.participant_id} bill={b} />
              ))}
            </ul>
            {bills.length > HISTORY_PREVIEW && (
              <div className="border-t border-border p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show fewer' : `Show all ${bills.length}`}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* the activity log is private to the admin */}
      {admin.isAdmin && (
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <span className="text-sm font-semibold text-muted-foreground">by or about {member.name.split(' ')[0]}</span>
        </CardHeader>
        <CardContent>
          <ActivityFeed groupId={member.group_id} memberId={member.id} pageSize={10} compact loadMore />
        </CardContent>
      </Card>
      )}
    </div>
  );
}
