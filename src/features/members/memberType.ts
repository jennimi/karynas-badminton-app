import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Member } from '../../shared/types';
import { todayString } from '../../shared/utils/format';
import { getAttendance, getSessionSummaries } from '../sessions/api';

export type MemberType = 'newcomer' | 'guest' | 'hiatus' | 'nolep' | 'regular';

/** Every threshold lives here, so the rules are easy to tune. */
export const TYPE_RULES = {
  /** Newcomer: every session they joined is among the group's N most recent. */
  newcomerRecentSessions: 5,
  /** Guest: joined at most this many sessions in total... */
  guestMaxSessions: 2,
  /** ...and Guest/Hiatus: haven't joined for more than this many days. */
  inactiveDays: 21,
  /** Nolep: joined more than this share of the sessions in the window. */
  nolepShare: 0.65,
  /** Nolep and Regular both look at the past N weeks. */
  nolepWindowWeeks: 8,
  /** Nolep needs at least this many sessions in the window to count. */
  nolepMinSessions: 3,
};

/** Display order = priority order (first rule that matches wins). */
export const memberTypeInfo: Record<
  MemberType,
  { label: string; variant: 'brand' | 'neutral' | 'butter' | 'coral' | 'lime'; rule: string; blurb: string }
> = {
  newcomer: {
    label: 'Newcomer',
    variant: 'brand',
    rule: `Only joined within the group's ${TYPE_RULES.newcomerRecentSessions} most recent sessions`,
    blurb: `New to the group. Every session they joined is among the ${TYPE_RULES.newcomerRecentSessions} most recent (or they haven’t played yet).`,
  },
  guest: {
    label: 'Guest',
    variant: 'neutral',
    rule: `Joined ${TYPE_RULES.guestMaxSessions} sessions or fewer, and not for over ${TYPE_RULES.inactiveDays / 7} weeks`,
    blurb: `Dropped by once or twice and hasn’t been back for over ${TYPE_RULES.inactiveDays / 7} weeks.`,
  },
  hiatus: {
    label: 'Hiatus',
    variant: 'butter',
    rule: `Played before, but not in the past ${TYPE_RULES.inactiveDays / 7} weeks`,
    blurb: `Used to play regularly, but hasn’t joined anything in the past ${TYPE_RULES.inactiveDays / 7} weeks.`,
  },
  nolep: {
    label: 'Nolep',
    variant: 'coral',
    rule: `Joined over ${TYPE_RULES.nolepShare * 100}% of the sessions in the past ${TYPE_RULES.nolepWindowWeeks} weeks`,
    blurb: `Shows up to almost everything: over ${TYPE_RULES.nolepShare * 100}% of the sessions in the past ${TYPE_RULES.nolepWindowWeeks} weeks (needs at least ${TYPE_RULES.nolepMinSessions} sessions in that time).`,
  },
  regular: {
    label: 'Regular',
    variant: 'lime',
    rule: `Everyone else, judged on the past ${TYPE_RULES.nolepWindowWeeks} weeks`,
    blurb: `Plays often enough, but not at everything in the past ${TYPE_RULES.nolepWindowWeeks} weeks.`,
  },
};

export interface MemberTypeResult {
  type: MemberType;
  /** Sessions played so far (not counting upcoming ones). */
  played: number;
  lastPlayed: string | null;
  /** e.g. "6 sessions · last played 25 days ago" */
  detail: string;
  /** plain-language reason for this label, with this person's numbers */
  why: string;
}

const DAY = 86_400_000;
const toTime = (d: string) => new Date(d + 'T00:00:00').getTime();

export function classifyMembers(
  members: Member[],
  sessions: { id: string; date: string }[],
  attendance: { session_id: string; member_id: string }[],
  today: string
): Map<string, MemberTypeResult> {
  const now = toTime(today);
  // Only sessions that have happened (today counts) say anything about activity.
  const past = sessions.filter((s) => s.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const dateOf = new Map(past.map((s) => [s.id, s.date]));
  const recent = new Set(past.slice(0, TYPE_RULES.newcomerRecentSessions).map((s) => s.id));
  const windowStart = now - TYPE_RULES.nolepWindowWeeks * 7 * DAY;
  const windowIds = new Set(past.filter((s) => toTime(s.date) > windowStart).map((s) => s.id));

  const joined = new Map<string, string[]>(); // member -> session ids (past only)
  for (const a of attendance) {
    if (!dateOf.has(a.session_id)) continue;
    const list = joined.get(a.member_id) ?? [];
    list.push(a.session_id);
    joined.set(a.member_id, list);
  }

  const result = new Map<string, MemberTypeResult>();
  for (const m of members) {
    const ids = joined.get(m.id) ?? [];
    const dates = ids.map((id) => dateOf.get(id)!).sort();
    const lastPlayed = dates.at(-1) ?? null;
    const daysAway = lastPlayed ? Math.round((now - toTime(lastPlayed)) / DAY) : null;
    const away = daysAway !== null && daysAway > TYPE_RULES.inactiveDays;

    let type: MemberType;
    if (ids.every((id) => recent.has(id))) {
      // includes members who haven't played a session yet
      type = 'newcomer';
    } else if (ids.length <= TYPE_RULES.guestMaxSessions && away) {
      type = 'guest';
    } else if (away) {
      type = 'hiatus';
    } else if (
      windowIds.size >= TYPE_RULES.nolepMinSessions &&
      ids.filter((id) => windowIds.has(id)).length / windowIds.size > TYPE_RULES.nolepShare
    ) {
      type = 'nolep';
    } else {
      type = 'regular';
    }

    const plural = `${ids.length} session${ids.length === 1 ? '' : 's'}`;
    const detail =
      daysAway === null
        ? 'Hasn’t played a session yet'
        : `${plural} · last played ${daysAway === 0 ? 'today' : `${daysAway} day${daysAway === 1 ? '' : 's'} ago`}`;
    const inWindow = ids.filter((id) => windowIds.has(id)).length;
    const days = `${daysAway} day${daysAway === 1 ? '' : 's'}`;
    const why: Record<MemberType, string> = {
      newcomer:
        ids.length === 0
          ? 'Hasn’t joined a session yet.'
          : `Joined ${plural}.`,
      guest: `Joined only ${plural}, and the last was ${days} ago.`,
      hiatus: `Joined ${plural} but nothing for ${days}.`,
      nolep: `Joined ${inWindow} of the ${windowIds.size} sessions in the past ${TYPE_RULES.nolepWindowWeeks} weeks.`,
      regular:
        windowIds.size < TYPE_RULES.nolepMinSessions
          ? `Joined ${plural}, last ${daysAway === 0 ? 'today' : `${days} ago`}.`
          : `Joined ${inWindow} of the ${windowIds.size} sessions in the past ${TYPE_RULES.nolepWindowWeeks} weeks.`,
    };
    result.set(m.id, { type, played: ids.length, lastPlayed, detail, why: why[type] });
  }
  return result;
}

export type MemberSort = 'name' | 'sessions' | 'status';

/** Sort members by name, sessions joined, or status (in priority order). */
export function sortMembers<T extends { id: string; name: string }>(
  list: T[],
  types: Map<string, MemberTypeResult>,
  key: MemberSort,
  dir: 'asc' | 'desc'
): T[] {
  const order = Object.keys(memberTypeInfo);
  const sign = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const ta = types.get(a.id);
    const tb = types.get(b.id);
    const c =
      key === 'sessions'
        ? (ta?.played ?? 0) - (tb?.played ?? 0)
        : key === 'status'
          ? order.indexOf(ta?.type ?? 'regular') - order.indexOf(tb?.type ?? 'regular')
          : a.name.localeCompare(b.name);
    return c * sign || a.name.localeCompare(b.name);
  });
}

/** Member types for a group, worked out from its sessions and attendance. */
export function useMemberTypes(groupId: string | undefined, members: Member[]) {
  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', groupId],
    queryFn: () => getSessionSummaries(groupId!),
    enabled: !!groupId,
  });
  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance', groupId],
    queryFn: () => getAttendance(groupId!),
    enabled: !!groupId,
  });
  return useMemo(
    () => classifyMembers(members, sessions, attendance, todayString()),
    [members, sessions, attendance]
  );
}
