// Chat history: the sessions found in the group's WhatsApp chat. Review them, import them,
// and keep the imported sessions in sync (member / payment fixes go to the real session).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronRight, ExternalLink, Link2, Lock, LockOpen, Plus, SkipForward, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { RallyLoader } from '../../shared/components/brand/RallyLoader';
import { PageHeader } from '../../shared/components/PageHeader';
import { cn } from '../../shared/lib/cn';
import type { Member, SessionSummary, SessionWithParticipants } from '../../shared/types';
import { Alert } from '../../shared/ui/alert';
import { Badge } from '../../shared/ui/badge';
import { Button } from '../../shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { Input } from '../../shared/ui/input';
import { Skeleton } from '../../shared/ui/skeleton';
import { COST_UNIT, formatCost, formatDate, formatMoney } from '../../shared/utils/format';
import { matchNames, nameKey } from '../../shared/utils/nameParser';
import { useCurrentGroup } from '../groups/hooks';
import { addMember, findDuplicate, getMembers } from '../members/api';
import { setPaymentStatus, setSessionCost } from '../payments/api';
import { AdminDialog } from '../payments/components/AdminDialog';
import { useAdmin } from '../payments/useAdmin';
import { createSession, getSession, getSessionSummaries, updateSession } from '../sessions/api';
import {
  getLinks,
  getNameRules,
  saveLink,
  saveNameRules,
  type ChatLink,
  type Mapping,
  type NameRule,
  type Target,
} from './api';
import type { ListMsg, ParsedChat, SessionDraft } from './parseChat';

type ChatData = ParsedChat & { generatedAt: string };
type Admin = ReturnType<typeof useAdmin>;
type Resolve = (core: string, date: string, override?: Target) => Mapping;
type Registry = { ready: () => boolean; run: () => Promise<void> };

const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
const selectCls =
  'h-10 w-full rounded-control border border-border bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring';

// ------------------------------------------------------------------ who is who

function guessFor(core: string, members: Member[]): Mapping {
  const exact = members.find((m) => nameKey(m.name) === nameKey(core));
  if (exact) return { kind: 'member', id: exact.id, confirmed: true };
  const guess = matchNames([core], members)[0]?.suggestions[0];
  if (guess) return { kind: 'member', id: guess.id, confirmed: false };
  return { kind: 'new', name: titleCase(core), confirmed: false };
}

/** A per-session change wins, then the saved rule (with its "before date" twist), then a guess. */
function mappingAt(date: string, rule: NameRule | undefined, guess: Mapping, override?: Target): Mapping {
  if (override) return { ...override, confirmed: true };
  if (!rule) return guess;
  const t = rule.beforeDate && rule.beforeTarget && date < rule.beforeDate ? rule.beforeTarget : rule.target;
  return { ...t, confirmed: rule.confirmed };
}

const targetValue = (t: Target) => (t.kind === 'member' ? t.id : t.kind);
const targetFrom = (v: string, core: string): Target =>
  v === 'new' ? { kind: 'new', name: titleCase(core) } : v === 'skip' ? { kind: 'skip' } : { kind: 'member', id: v };

function TargetSelect({
  label,
  value,
  members,
  onChange,
  className,
}: {
  label: string;
  value: Target;
  members: Member[];
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      className={cn(selectCls, className)}
      value={targetValue(value)}
      onChange={(e) => onChange(e.target.value)}
    >
      {members.map((x) => (
        <option key={x.id} value={x.id}>
          {x.name}
        </option>
      ))}
      <option value="new">➕ Create new member…</option>
      <option value="skip">🚫 Not a player (ignore)</option>
    </select>
  );
}

function NameMapper({
  cores,
  usage,
  members,
  rules,
  guesses,
  onSave,
}: {
  cores: string[];
  usage: Map<string, number>;
  members: Member[];
  rules: Record<string, NameRule>;
  guesses: Record<string, Mapping>;
  onSave: (rules: NameRule[]) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = cores
    .map((core) => {
      const rule = rules[core];
      const g = guesses[core];
      const base: NameRule = rule ?? { core, target: g, confirmed: g.confirmed, beforeDate: null, beforeTarget: null };
      return { core, rule: base };
    })
    .sort(
      (a, b) =>
        Number(a.rule.confirmed) - Number(b.rule.confirmed) || (usage.get(b.core) ?? 0) - (usage.get(a.core) ?? 0)
    );
  const todo = rows.filter((r) => !r.rule.confirmed);
  const shown = showAll ? rows : todo;
  const strip = (t: Target): Target => (t.kind === 'new' ? { kind: 'new', name: t.name } : t);

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <CardTitle className="flex items-center gap-2">
          Who is who{' '}
          <Badge variant={todo.length ? 'butter' : 'lime'}>{todo.length ? `${todo.length} to check` : 'all matched'}</Badge>
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'Show only unchecked' : `Show all ${rows.length}`}
          </Button>
          {todo.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onSave(todo.map((r) => ({ ...r.rule, target: strip(r.rule.target), confirmed: true })))}
            >
              <Check /> Confirm all guesses
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Chat names are nicknames. If a name meant someone else earlier (like “theo” before October), add “different
          person before a date”. You can also change one person in a single session below. Saved for everyone.
        </p>
        {shown.length === 0 && <p className="py-4 text-center text-sm font-bold">All names are matched 🎉</p>}
        {shown.map(({ core, rule }) => {
          const save = (patch: Partial<NameRule>) => onSave([{ ...rule, target: strip(rule.target), ...patch }]);
          return (
            <div
              key={core}
              className={cn(
                'space-y-2 rounded-2xl border p-2.5',
                rule.confirmed ? 'border-border' : 'border-butter bg-butter-soft/40'
              )}
            >
              <div className="grid items-center gap-2 sm:grid-cols-[10rem_1fr_auto]">
                <div className="min-w-0">
                  <p className="truncate font-extrabold">{core}</p>
                  <p className="text-xs text-muted-foreground">in {usage.get(core) ?? 0} sessions</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <TargetSelect
                    label={`Who is “${core}”?`}
                    value={rule.target}
                    members={members}
                    className="min-w-48 flex-1"
                    onChange={(v) => save({ target: targetFrom(v, core), confirmed: true })}
                  />
                  {rule.target.kind === 'new' && (
                    <Input
                      aria-label={`New member name for ${core}`}
                      className="min-w-40 flex-1"
                      defaultValue={rule.target.name}
                      onBlur={(e) => save({ target: { kind: 'new', name: e.target.value.trim() || titleCase(core) } })}
                    />
                  )}
                </div>
                {rule.confirmed ? (
                  <Badge variant="lime">
                    <Check className="size-3.5" /> OK
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => save({ confirmed: true })}>
                    <Check /> Confirm
                  </Button>
                )}
              </div>

              {rule.beforeDate && rule.beforeTarget ? (
                <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-[10.5rem]">
                  <span className="text-xs font-bold">Before</span>
                  <Input
                    type="date"
                    aria-label={`${core}: different person before this date`}
                    className="w-40"
                    defaultValue={rule.beforeDate}
                    onBlur={(e) => e.target.value && save({ beforeDate: e.target.value })}
                  />
                  <span className="text-xs font-bold">it was</span>
                  <TargetSelect
                    label={`${core} before ${rule.beforeDate}`}
                    value={rule.beforeTarget}
                    members={members}
                    className="min-w-48 flex-1"
                    onChange={(v) => save({ beforeTarget: targetFrom(v, core), confirmed: true })}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove the date rule"
                    onClick={() => save({ beforeDate: null, beforeTarget: null })}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ) : (
                <div className="pl-0 sm:pl-[10.5rem]">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => save({ beforeDate: '2026-10-01', beforeTarget: strip(rule.target) })}
                  >
                    <Plus /> Different person before a date
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ evidence

function MessageBox({ label, msg }: { label: string; msg: ListMsg | null }) {
  if (!msg) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">
        <p className="text-xs font-extrabold uppercase tracking-wider">{label}</p>
        Not found
      </div>
    );
  }
  const m = msg.msg;
  return (
    <div className="rounded-2xl bg-muted/60 p-3">
      <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-bold">
        {m.author} · {formatDate(m.date)} · {m.time}
      </p>
      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap font-sans text-xs">{m.text}</pre>
    </div>
  );
}

function Evidence({ draft }: { draft: SessionDraft }) {
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-3">
        <MessageBox label="Before: final sign-up list" msg={draft.finalSignup} />
        <MessageBox label="Price announced" msg={draft.priceFirst} />
        <MessageBox label="After: payment list with marks" msg={draft.priceLast} />
      </div>
      {draft.reposts.length > 1 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-bold">{draft.reposts.length} reposts of the payment list</summary>
          <ul className="mt-1 space-y-0.5">
            {draft.reposts.map((r, i) => (
              <li key={i}>
                {r.author} · {formatDate(r.date)} {r.time} · {r.marks} marks
              </li>
            ))}
          </ul>
        </details>
      )}
      {!draft.price && draft.priceHints.length > 0 && (
        <div className="rounded-2xl bg-butter-soft p-3 text-xs">
          <p className="font-extrabold uppercase tracking-wider text-butter-strong">Price mentioned in plain messages</p>
          {draft.priceHints.map((h) => (
            <p key={h.index} className="mt-1">
              <b>{h.author}</b> · {formatDate(h.date)} {h.time}: {h.text.replace(/\n/g, ' ⏎ ')}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ a session not imported yet

interface RowProps {
  draft: SessionDraft;
  link?: ChatLink;
  resolve: Resolve;
  members: Member[];
  existing: SessionSummary[];
  groupId: string;
  admin: Admin;
  registry: React.MutableRefObject<Map<string, Registry>>;
  onLink: (l: ChatLink) => void;
}

function DraftCard({ draft, link, resolve, members, existing, groupId, admin, registry, onLink }: RowProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState(draft.date);
  const [start, setStart] = useState(draft.start ?? '');
  const [end, setEnd] = useState(draft.end ?? '');
  const [location, setLocation] = useState(draft.location ?? '');
  const [cost, setCost] = useState(draft.price ? String(draft.price.total / COST_UNIT) : '');
  const [overrides, setOverrides] = useState<Record<string, Target>>(link?.overrides ?? {});
  const [include, setInclude] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(draft.participants.map((p) => [p.core, !p.cancelled]))
  );
  const [paid, setPaid] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(draft.participants.map((p) => [p.core, p.paid]))
  );

  const costNum = cost.trim() === '' ? null : Number(cost);
  const map = (core: string) => resolve(core, date, overrides[core]);
  const chosen = draft.participants.filter((p) => include[p.core] && map(p.core).kind !== 'skip');
  const paidCount = chosen.filter((p) => paid[p.core]).length;
  const unconfirmed = chosen.filter((p) => !map(p.core).confirmed);
  const sameDay = existing.filter((s) => s.date === date);
  const exists = sameDay.length > 0;
  const needsAdmin = costNum != null || paidCount > 0;
  const problem = !date
    ? 'Pick a date.'
    : chosen.length === 0
      ? 'No participants selected.'
      : unconfirmed.length
        ? `Confirm ${unconfirmed.length} name${unconfirmed.length === 1 ? '' : 's'} in “Who is who” first.`
        : costNum != null && !(costNum >= 0)
          ? 'Cost is not a number.'
          : paidCount > 0 && costNum == null
            ? 'Payments need a cost. Enter the total, or untick the paid people.'
            : needsAdmin && !admin.isAdmin
              ? 'Unlock admin mode (top of the page) to save cost and payments.'
              : '';

  const changeMember = (core: string, v: string) => {
    const next = { ...overrides, [core]: targetFrom(v, core) };
    setOverrides(next);
    onLink({ draftKey: draft.key, sessionId: null, status: 'draft', overrides: next });
  };

  const run = async () => {
    if (problem) throw new Error(problem);
    setWorking(true);
    setError('');
    try {
      const fresh = await getMembers(groupId);
      const ids = new Map<string, boolean>(); // member id -> paid
      for (const p of chosen) {
        const t = map(p.core);
        let id: string;
        if (t.kind === 'member') id = t.id;
        else if (t.kind === 'new') {
          const dupe = findDuplicate(fresh, t.name);
          if (dupe) id = dupe.id;
          else {
            const created = await addMember(groupId, t.name, fresh);
            fresh.push(created);
            id = created.id;
          }
        } else continue;
        ids.set(id, (ids.get(id) ?? false) || !!paid[p.core]);
      }
      const session = await createSession({
        group_id: groupId,
        date,
        start_time: start || undefined,
        end_time: end || undefined,
        location: location.trim() || undefined,
        notes: 'Imported from the WhatsApp chat',
        participant_member_ids: [...ids.keys()],
      });
      if (costNum != null) await setSessionCost(session.id, costNum, admin.code!);
      const toApprove = [...ids].filter(([, v]) => v).map(([id]) => id);
      if (toApprove.length) {
        const full = await getSession(session.id);
        for (const part of full.participants) {
          if (toApprove.includes(part.member_id)) await setPaymentStatus(part.id, 'approved', admin.code);
        }
      }
      onLink({ draftKey: draft.key, sessionId: session.id, status: 'imported', overrides });
      for (const k of ['sessions', 'members', 'groups', 'attendance', 'upcomingSessions', 'session']) {
        queryClient.invalidateQueries({ queryKey: [k] });
      }
      toast.success(`Imported ${formatDate(date)}`);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    registry.current.set(draft.key, { ready: () => !working && !problem && !exists && !!draft.price, run });
  });

  const share = costNum != null && chosen.length > 0 ? costNum / chosen.length : null;
  const warns = draft.warnings.filter((w) => !w.startsWith('AM'));

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-4 text-left"
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <span className="font-extrabold">{formatDate(date)}</span>
        <span className="text-sm text-muted-foreground">
          {[start && end ? `${start}–${end}` : null, location || null].filter(Boolean).join(' · ')}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {exists && <Badge variant="coral">Date already in app</Badge>}
          {draft.price ? (
            <Badge variant="brand">
              {formatMoney(draft.price.total)} / {draft.price.count}
            </Badge>
          ) : (
            <Badge variant="butter">No payment list</Badge>
          )}
          <Badge>{chosen.length} people</Badge>
          {draft.price && <Badge variant="lime">{paidCount} paid</Badge>}
          {warns.length > 0 && <Badge variant="coral">⚠ check</Badge>}
        </span>
      </button>

      {open && (
        <CardContent className="space-y-4 border-t border-border pt-4">
          {draft.warnings.map((w) => (
            <Alert key={w}>
              <p>{w}</p>
            </Alert>
          ))}
          {exists && (
            <Alert>
              <p>
                The app already has a session on this date. Link this to it (nothing is created), or import anyway
                to create another one.
              </p>
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-5">
            <label className="space-y-1 text-xs font-bold">
              Date
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="space-y-1 text-xs font-bold">
              Start
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="space-y-1 text-xs font-bold">
              End
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
            <label className="space-y-1 text-xs font-bold">
              Location
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </label>
            <label className="space-y-1 text-xs font-bold">
              Total cost (Rp, in thousands)
              <Input type="number" min={0} step="any" placeholder="208" value={cost} onChange={(e) => setCost(e.target.value)} />
            </label>
          </div>
          {share != null && (
            <p className="text-xs text-muted-foreground">
              Total <b>{formatCost(costNum!)}</b> · each person in the app: <b>{formatCost(share)}</b>
              {draft.price?.perPerson ? ` · chat said ${formatMoney(draft.price.perPerson)}` : ''}
            </p>
          )}

          <Evidence draft={draft} />

          <div>
            <p className="mb-1 text-sm font-extrabold">Participants & payment</p>
            <ul className="divide-y divide-border">
              {draft.participants.map((p) => {
                const t = map(p.core);
                return (
                  <li key={p.core} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      aria-label={`Include ${p.core}`}
                      className="size-4 accent-brand"
                      checked={!!include[p.core]}
                      onChange={(e) => setInclude((s) => ({ ...s, [p.core]: e.target.checked }))}
                    />
                    <span className="w-28 truncate font-bold">{p.core}</span>
                    <span className="text-muted-foreground">→</span>
                    <TargetSelect
                      label={`Who is “${p.core}” in this session?`}
                      value={t}
                      members={members}
                      className={cn('h-9 w-44', !t.confirmed && 'border-butter')}
                      onChange={(v) => changeMember(p.core, v)}
                    />
                    {t.kind === 'new' && <Badge variant="brand">new: {t.name}</Badge>}
                    {!t.confirmed && <Badge variant="butter">unconfirmed</Badge>}
                    {overrides[p.core] && <Badge>changed here</Badge>}
                    {p.cancelled && <Badge variant="coral">said can’t come</Badge>}
                    {p.tentative && <Badge variant="butter">maybe</Badge>}
                    {p.paidForCourt && <Badge variant="brand">paid for the court</Badge>}
                    {p.addedLater && <Badge>added on a repost</Badge>}
                    {p.markedInOriginal && <Badge variant="butter">emoji already in original</Badge>}
                    {p.paidBy && !p.paidForCourt && (
                      <span className="text-xs text-muted-foreground">
                        marked by {p.paidBy.author}, {formatDate(p.paidBy.date)} {p.paidBy.time}
                      </span>
                    )}
                    <label className="ml-auto flex items-center gap-1.5 text-xs font-bold">
                      <input
                        type="checkbox"
                        className="size-4 accent-lime"
                        checked={!!paid[p.core]}
                        onChange={(e) => setPaid((s) => ({ ...s, [p.core]: e.target.checked }))}
                      />
                      Paid
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          {error && (
            <Alert>
              <p>{error}</p>
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="lime" disabled={working || !!problem} onClick={() => run().catch(() => undefined)}>
              <Check /> {working ? 'Importing…' : exists ? 'Import anyway' : 'Approve & import'}
            </Button>
            {exists && (
              <Button
                variant="secondary"
                disabled={working}
                onClick={() => onLink({ draftKey: draft.key, sessionId: sameDay[0].id, status: 'imported', overrides })}
              >
                <Link2 /> Link to the existing session
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={working}
              onClick={() => onLink({ draftKey: draft.key, sessionId: null, status: 'skipped', overrides })}
            >
              <SkipForward /> Skip this session
            </Button>
            {problem && <span className="text-xs font-semibold text-butter-strong">{problem}</span>}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ an imported session: edit it, it saves to the real session

interface EditRow {
  key: string;
  memberId: string;
  paid: boolean;
  removed: boolean;
  /** payment status in the app right now (for new rows: unpaid) */
  was: 'unpaid' | 'pending' | 'approved';
}

function LinkedForm({
  session,
  draft,
  members,
  admin,
}: {
  session: SessionWithParticipants;
  draft: SessionDraft;
  members: Member[];
  admin: Admin;
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(session.date);
  const [start, setStart] = useState(session.start_time?.slice(0, 5) ?? '');
  const [end, setEnd] = useState(session.end_time?.slice(0, 5) ?? '');
  const [location, setLocation] = useState(session.location ?? '');
  const [cost, setCost] = useState(session.total_cost != null ? String(session.total_cost) : '');
  const [rows, setRows] = useState<EditRow[]>(() =>
    session.participants.map((p) => ({
      key: p.id,
      memberId: p.member_id,
      paid: p.payment_status === 'approved',
      removed: false,
      was: p.payment_status,
    }))
  );
  const [adding, setAdding] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const costNum = cost.trim() === '' ? null : Number(cost);
  const live = rows.filter((r) => !r.removed);
  const dupes = live.length !== new Set(live.map((r) => r.memberId)).size;
  const costChanged = (costNum ?? null) !== (session.total_cost ?? null);
  const paidChanged = rows.some((r) => !r.removed && r.paid !== (r.was === 'approved'));
  const problem = !date
    ? 'Pick a date.'
    : dupes
      ? 'The same member is on the list twice.'
      : costNum != null && !(costNum >= 0)
        ? 'Cost is not a number.'
        : live.some((r) => r.paid) && costNum == null
          ? 'Payments need a cost.'
          : (costChanged || paidChanged) && !admin.isAdmin
            ? 'Unlock admin mode (top of the page) to change cost or payments.'
            : '';
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '?';
  const patch = (key: string, p: Partial<EditRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await updateSession(session.id, {
        date,
        start_time: start,
        end_time: end,
        location,
        participant_member_ids: live.map((r) => r.memberId),
      });
      if (costChanged) await setSessionCost(session.id, costNum, admin.code!);
      const full = await getSession(session.id);
      const byMember = new Map(full.participants.map((p) => [p.member_id, p]));
      for (const r of live) {
        const part = byMember.get(r.memberId);
        if (!part) continue;
        if (r.paid && part.payment_status !== 'approved') await setPaymentStatus(part.id, 'approved', admin.code);
        if (!r.paid && part.payment_status === 'approved') await setPaymentStatus(part.id, 'unpaid', admin.code);
      }
      for (const k of ['session', 'sessions', 'groups', 'attendance', 'upcomingSessions']) {
        queryClient.invalidateQueries({ queryKey: [k] });
      }
      toast.success('Saved to the session');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const unused = members.filter((m) => !live.some((r) => r.memberId === m.id));
  // names in the chat's payment list: lets you spot who is missing / different
  const chatNames = draft.participants.map((p) => p.core).join(', ');

  return (
    <CardContent className="space-y-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="lime">Linked to a session in the app</Badge>
        <Link to={`/sessions/${session.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-brand-strong hover:underline">
          Open session <ExternalLink className="size-3.5" />
        </Link>
        <span className="text-xs text-muted-foreground">Changes you save here update that session.</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <label className="space-y-1 text-xs font-bold">
          Date
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-bold">
          Start
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-bold">
          End
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-bold">
          Location
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-bold">
          Total cost (Rp, in thousands)
          <Input type="number" min={0} step="any" placeholder="208" value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
      </div>

      <Evidence draft={draft} />
      <p className="text-xs text-muted-foreground">
        Names in the chat: <span className="font-semibold">{chatNames}</span>
      </p>

      <div>
        <p className="mb-1 text-sm font-extrabold">Participants & payment</p>
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.key} className={cn('flex flex-wrap items-center gap-2 py-1.5 text-sm', r.removed && 'opacity-40')}>
              <select
                aria-label="Member"
                className={cn(selectCls, 'h-9 w-52')}
                value={r.memberId}
                disabled={r.removed}
                onChange={(e) => patch(r.key, { memberId: e.target.value })}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {r.was === 'pending' && <Badge variant="butter">member ticked: waiting</Badge>}
              <label className="ml-auto flex items-center gap-1.5 text-xs font-bold">
                <input
                  type="checkbox"
                  className="size-4 accent-lime"
                  checked={r.paid}
                  disabled={r.removed}
                  onChange={(e) => patch(r.key, { paid: e.target.checked })}
                />
                Paid (approved)
              </label>
              <Button
                size="icon"
                variant="ghost"
                aria-label={r.removed ? `Put ${nameOf(r.memberId)} back` : `Remove ${nameOf(r.memberId)}`}
                onClick={() => patch(r.key, { removed: !r.removed })}
              >
                {r.removed ? <Undo2 /> : <Trash2 />}
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            aria-label="Add a participant"
            className={cn(selectCls, 'h-9 w-52')}
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
          >
            <option value="">Add a participant…</option>
            {unused.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={!adding}
            onClick={() => {
              setRows((rs) => [...rs, { key: `new-${adding}`, memberId: adding, paid: false, removed: false, was: 'unpaid' }]);
              setAdding('');
            }}
          >
            <Plus /> Add
          </Button>
        </div>
      </div>

      {error && (
        <Alert>
          <p>{error}</p>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={saving || !!problem} onClick={save}>
          <Check /> {saving ? 'Saving…' : 'Save to session'}
        </Button>
        {problem && <span className="text-xs font-semibold text-butter-strong">{problem}</span>}
      </div>
    </CardContent>
  );
}

function LinkedCard({
  draft,
  summary,
  members,
  admin,
  onLink,
  link,
}: {
  draft: SessionDraft;
  summary: SessionSummary;
  members: Member[];
  admin: Admin;
  onLink: (l: ChatLink) => void;
  link: ChatLink;
}) {
  const [open, setOpen] = useState(false);
  const { data: session } = useQuery({
    queryKey: ['session', summary.id],
    queryFn: () => getSession(summary.id),
    enabled: open,
  });
  const sig = session
    ? `${session.id}:${session.total_cost}:${session.date}:${session.participants.map((p) => p.id + p.payment_status).join()}`
    : '';

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-4 text-left"
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <span className="font-extrabold">{formatDate(summary.date)}</span>
        <span className="text-sm text-muted-foreground">{summary.location}</span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <Badge variant="lime">Imported ✓</Badge>
          {summary.total_cost != null && <Badge variant="brand">{formatCost(summary.total_cost)}</Badge>}
          <Badge>{summary.participant_count} people</Badge>
          {summary.total_cost != null && (
            <Badge variant={summary.approved_count === summary.participant_count ? 'lime' : 'butter'}>
              {summary.approved_count}/{summary.participant_count} paid
            </Badge>
          )}
        </span>
      </button>
      {open && !session && <Skeleton className="m-4 h-32" />}
      {open && session && (
        <>
          <LinkedForm key={sig} session={session} draft={draft} members={members} admin={admin} />
          <div className="px-4 pb-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onLink({ ...link, sessionId: null, status: 'draft' })}
              title="Forget the link. The session in the app is not deleted."
            >
              <Undo2 /> Unlink from the chat
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ page

type Filter = 'todo' | 'nopay' | 'done' | 'all';

export default function ChatImportPage() {
  // Not linked from the menu and kept out of search engines: reachable only by its address.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  const queryClient = useQueryClient();
  const { data: group } = useCurrentGroup();
  const admin = useAdmin(group?.id);
  const [unlocking, setUnlocking] = useState(false);
  const [filter, setFilter] = useState<Filter>('todo');
  const [confirmAll, setConfirmAll] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const registry = useRef(new Map<string, Registry>());
  const gid = group?.id;

  const { data: chat } = useQuery({
    queryKey: ['chatData'],
    queryFn: async () => (await import('./data/chatSessions.json')).default as unknown as ChatData,
    staleTime: Infinity,
  });
  const { data: members = [] } = useQuery({
    queryKey: ['members', gid],
    queryFn: () => getMembers(gid!),
    enabled: !!gid,
  });
  const { data: existing = [] } = useQuery({
    queryKey: ['sessions', gid],
    queryFn: () => getSessionSummaries(gid!),
    enabled: !!gid,
  });
  const { data: rules = {}, isError: rulesError } = useQuery({
    queryKey: ['chatNameMap', gid],
    queryFn: () => getNameRules(gid!),
    enabled: !!gid,
  });
  const { data: links = {} } = useQuery({
    queryKey: ['chatLinks', gid],
    queryFn: () => getLinks(gid!),
    enabled: !!gid,
  });

  const sessions = useMemo(() => chat?.sessions ?? [], [chat]);
  const { cores, usage } = useMemo(() => {
    const usage = new Map<string, number>();
    for (const s of sessions) for (const p of s.participants) usage.set(p.core, (usage.get(p.core) ?? 0) + 1);
    return { cores: [...usage.keys()], usage };
  }, [sessions]);
  const guesses = useMemo(
    () => Object.fromEntries(cores.map((c) => [c, guessFor(c, members)])) as Record<string, Mapping>,
    [cores, members]
  );
  const resolve: Resolve = (core, date, override) =>
    mappingAt(date, rules[core], guesses[core] ?? guessFor(core, members), override);

  const onSaveRules = (list: NameRule[]) => {
    if (!gid) return;
    queryClient.setQueryData<Record<string, NameRule>>(['chatNameMap', gid], (old = {}) => ({
      ...old,
      ...Object.fromEntries(list.map((r) => [r.core, r])),
    }));
    saveNameRules(gid, list).catch((e: Error) => {
      toast.error(e.message);
      queryClient.invalidateQueries({ queryKey: ['chatNameMap', gid] });
    });
  };
  const onLink = (l: ChatLink) => {
    if (!gid) return;
    queryClient.setQueryData<Record<string, ChatLink>>(['chatLinks', gid], (old = {}) => ({ ...old, [l.draftKey]: l }));
    saveLink(gid, l).catch((e: Error) => {
      toast.error(e.message);
      queryClient.invalidateQueries({ queryKey: ['chatLinks', gid] });
    });
  };

  const approveAll = async () => {
    setConfirmAll(false);
    setBulkBusy(true);
    let ok = 0;
    for (const [, r] of [...registry.current]) {
      if (!r.ready()) continue;
      try {
        await r.run();
        ok++;
      } catch {
        /* the card shows its own error */
      }
    }
    setBulkBusy(false);
    toast.success(`Imported ${ok} session${ok === 1 ? '' : 's'}`);
  };

  const sessionById = new Map(existing.map((s) => [s.id, s]));
  const stateOf = (d: SessionDraft) => {
    const l = links[d.key];
    if (l?.status === 'imported' && l.sessionId && sessionById.has(l.sessionId)) return 'imported' as const;
    if (l?.status === 'skipped') return 'skipped' as const;
    return 'open' as const;
  };
  const counts = {
    todo: sessions.filter((s) => s.price && stateOf(s) === 'open').length,
    nopay: sessions.filter((s) => !s.price && stateOf(s) === 'open').length,
    done: sessions.filter((s) => stateOf(s) !== 'open').length,
    all: sessions.length,
  };
  const visible = sessions.filter((s) => {
    const st = stateOf(s);
    return (
      filter === 'all' ||
      (filter === 'done' && st !== 'open') ||
      (filter === 'todo' && !!s.price && st === 'open') ||
      (filter === 'nopay' && !s.price && st === 'open')
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat history"
        description="Past sessions found in the group chat: review them, import them, and fix members or payments."
        actions={
          admin.isAdmin ? (
            <Button variant="secondary" onClick={admin.lock}>
              <LockOpen /> Admin on · Lock
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setUnlocking(true)} disabled={!group}>
              <Lock /> Unlock admin
            </Button>
          )
        }
      />

      {rulesError && (
        <Alert>
          <p>
            The database tables for this page are missing. Run <b>supabase/migrations/005_chat_import.sql</b> in the
            Supabase SQL Editor, then reload.
          </p>
        </Alert>
      )}

      {!chat || !group ? (
        <RallyLoader message="Loading the chat history…" />
      ) : (
        <>
          <Alert tone="info">
            <p>
              {sessions.length} sessions found in the chat ({formatDate(chat.firstDate)} to {formatDate(chat.lastDate)},
              built {chat.generatedAt}), for <b>{group.emoji} {group.name}</b>. Approving creates the session, sets its cost
              and approves the paid people. Cost and approvals need the admin passcode.
            </p>
          </Alert>

          <NameMapper
            cores={cores}
            usage={usage}
            members={members}
            rules={rules}
            guesses={guesses}
            onSave={onSaveRules}
          />

          <section className="space-y-3" aria-label="Sessions found">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-2 text-lg font-extrabold">Sessions</h2>
              {(
                [
                  ['todo', 'With payments'],
                  ['nopay', 'No payment list'],
                  ['done', 'Imported / skipped'],
                  ['all', 'All'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={filter === k}
                  onClick={() => setFilter(k)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-bold',
                    filter === k ? 'bg-brand text-ink' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label} · {counts[k]}
                </button>
              ))}
              <Button className="ml-auto" size="sm" variant="lime" disabled={bulkBusy} onClick={() => setConfirmAll(true)}>
                <Check /> {bulkBusy ? 'Importing…' : 'Approve all ready'}
              </Button>
            </div>

            {visible.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nothing here.
              </p>
            )}
            {visible.map((s) => {
              const link = links[s.key];
              const st = stateOf(s);
              if (st === 'imported' && link?.sessionId) {
                return (
                  <LinkedCard
                    key={s.key}
                    draft={s}
                    link={link}
                    summary={sessionById.get(link.sessionId)!}
                    members={members}
                    admin={admin}
                    onLink={onLink}
                  />
                );
              }
              if (st === 'skipped' && link) {
                return (
                  <Card key={s.key} className="opacity-60">
                    <div className="flex flex-wrap items-center gap-3 p-4">
                      <span className="font-extrabold">{formatDate(s.date)}</span>
                      <Badge>Skipped</Badge>
                      <Button
                        className="ml-auto"
                        size="sm"
                        variant="outline"
                        onClick={() => onLink({ ...link, status: 'draft' })}
                      >
                        <Undo2 /> Undo skip
                      </Button>
                    </div>
                  </Card>
                );
              }
              return (
                <DraftCard
                  key={s.key}
                  draft={s}
                  link={link}
                  resolve={resolve}
                  members={members}
                  existing={existing}
                  groupId={group.id}
                  admin={admin}
                  registry={registry}
                  onLink={onLink}
                />
              );
            })}
          </section>

          {chat.skippedShuttlecock.length > 0 && (
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer font-bold">
                Not imported: {chat.skippedShuttlecock.length} shuttlecock payments
              </summary>
              <ul className="mt-1 list-disc pl-5">
                {chat.skippedShuttlecock.map((k) => (
                  <li key={k.header}>
                    {formatDate(k.date)}: {k.header}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        onConfirm={approveAll}
        title="Approve all ready sessions?"
        description="Every session that has a payment list, all names confirmed and no clash with an existing date will be imported with its costs and approved payments. Sessions with a problem are left for you."
        confirmLabel="Import them"
      />
      {unlocking && group && <AdminDialog groupId={group.id} onClose={() => setUnlocking(false)} />}
    </div>
  );
}
