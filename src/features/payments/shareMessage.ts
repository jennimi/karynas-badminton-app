import type { SessionWithParticipants } from '../../shared/types';
import { formatCost } from '../../shared/utils/format';

// ---------- compact links ----------
// A session id is a 36-character uuid. Written as base64url it is 22 characters:
//   https://rally-kba.vercel.app/sessions/3f2b8c1e-....   ->   https://rally-kba.vercel.app/s/PyuMHuWf...
// No database lookup needed: the code *is* the id, just written shorter.

/** uuid -> 22-character code. */
export function encodeSessionId(uuid: string): string {
  const hex = uuid.replace(/-/g, '');
  const bytes = hex.match(/../g)!.map((h) => parseInt(h, 16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** 22-character code -> uuid, or null if it isn't one of ours. */
export function decodeSessionId(code: string): string | null {
  if (!/^[A-Za-z0-9_-]{22}$/.test(code)) return null;
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/') + '==');
    if (bin.length !== 16) return null;
    const hex = Array.from(bin, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return null;
  }
}

/** The short link people tap; it opens the session on the Payments tab. */
export function shortSessionLink(origin: string, sessionId: string): string {
  return `${origin}/s/${encodeSessionId(sessionId)}`;
}

// ---------- the message ----------

/** Fun marks for people whose payment is approved. Same person = same emoji every time. */
const EMOJIS = [
  '🐢', '🦍', '👾', '🦈', '🦭', '🐝', '🤖', '🐌', '🦉', '🍤', '🍞', '🌌', '🔥', '🧶', '🍵', '✨',
  '🐑', '🦊', '🐙', '🦄', '🍉', '🌵', '🚀', '🎈', '🍀', '🦋', '🐧', '🍩', '🐸', '🌮', '🎯', '🍒',
];

/** A random-looking emoji that stays the same for the same member (so reshares don't shuffle them). */
export function emojiFor(memberId: string): string {
  let h = 0;
  for (const ch of memberId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EMOJIS[h % EMOJIS.length];
}

const dayDate = (date: string) => {
  const d = new Date(date + 'T00:00:00');
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const rest = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${weekday} - ${rest}`;
};

/**
 * The text people paste into the group chat:
 *   Thursday - 12 Nov 2026, Weston
 *   Rp 990.000 / 32 = Rp 30.937,5
 *
 *   1. Albert 🐢        (an emoji = payment approved; it's the one they chose, if they chose one)
 *   2. Charlotte
 *
 *   https://rally-kba.vercel.app/s/...
 */
/** The emoji a member chose for themselves, or their automatic one. */
export function memberEmoji(member: { id: string; emoji?: string | null }): string {
  return member.emoji?.trim() || emojiFor(member.id);
}

/** The emojis offered on a member's page (anything else can be typed in). */
export const EMOJI_CHOICES = EMOJIS;

export function buildPaymentMessage(session: SessionWithParticipants, origin: string): string {
  const people = [...session.participants].sort((a, b) => a.member.name.localeCompare(b.member.name));
  const n = people.length;
  const head = `${dayDate(session.date)}${session.location ? `, ${session.location}` : ''}`;
  const price =
    session.total_cost != null && n > 0
      ? `${formatCost(session.total_cost)} / ${n} = ${formatCost(session.total_cost / n)}`
      : null;
  const names = people.map(
    (p, i) => `${i + 1}. ${p.member.name}${p.payment_status === 'approved' ? ` ${memberEmoji(p.member)}` : ''}`
  );
  return [head, price, '', ...names, '', shortSessionLink(origin, session.id)]
    .filter((line) => line !== null)
    .join('\n');
}
