// Reads a WhatsApp chat export and works out sessions + payments.
// Pure functions (no React / network). Run by scripts/build-chat-data.ts, which
// stores the result in data/chatSessions.json (the app never ships the raw chat).

export interface ChatMessage {
  index: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  author: string;
  text: string;
}

export interface ListItem {
  raw: string;
  /** lower-case name with emoji / "maybe" etc. removed: the key used for matching */
  core: string;
  /** any emoji (or the word "centang") next to the name = paid */
  marked: boolean;
  tentative: boolean;
  cancelled: boolean;
}

export interface ListMsg {
  msg: ChatMessage;
  header: string;
  items: ListItem[];
}

export interface PriceInfo {
  /** whole amount in Rupiah, e.g. 327000 */
  total: number;
  /** how many people it was split between */
  count: number;
  /** per person in Rupiah as written in the chat (may be rounded) */
  perPerson: number | null;
}

export interface ParticipantDraft {
  core: string;
  tentative: boolean;
  cancelled: boolean;
  paid: boolean;
  /** who first put a mark next to this name, and when */
  paidBy: { author: string; date: string; time: string } | null;
  /** a mark was already there in the very first payment message (before anyone paid) */
  markedInOriginal: boolean;
  /** name wasn't on the first payment message, a later repost added it */
  addedLater: boolean;
  /** not on the payment list, but on the sign-up list: they paid for the court */
  paidForCourt: boolean;
}

export interface SessionDraft {
  key: string;
  date: string;
  dateHow: 'explicit' | 'weekday' | 'price-header' | 'matched';
  start: string | null;
  end: string | null;
  timeGuessed: boolean;
  location: string | null;
  /** how many sign-up lists were posted for this session */
  signupCount: number;
  /** the last sign-up list before payment: "the list before paying" */
  finalSignup: ListMsg | null;
  priceMsgs: ListMsg[];
  /** one entry per repost of the payment list: who, when, how many marks */
  reposts: { author: string; date: string; time: string; marks: number }[];
  priceHeader: string | null;
  price: PriceInfo | null;
  /** first price message, and the repost with the most paid marks */
  priceFirst: ListMsg | null;
  priceLast: ListMsg | null;
  participants: ParticipantDraft[];
  /** price talked about in plain sentences near the session (for sessions without a payment list) */
  priceHints: ChatMessage[];
  /** things worth a second look */
  warnings: string[];
}

export interface ParsedChat {
  messages: number;
  firstDate: string;
  lastDate: string;
  sessions: SessionDraft[];
  /** shuttlecock payments: skipped on purpose */
  skippedShuttlecock: { header: string; date: string; count: number }[];
}

// ---------------------------------------------------------------- messages

const MSG = /^\[(\d\d)\/(\d\d)\/(\d\d), (\d\d)\.(\d\d)\.(\d\d)\] ([^:]+): ?(.*)$/;

export function parseMessages(raw: string): ChatMessage[] {
  const clean = raw.replace(/[‎‏⁠‪-‮]/g, '');
  const out: ChatMessage[] = [];
  for (const line of clean.split(/\r?\n/)) {
    const m = MSG.exec(line);
    if (m) {
      out.push({
        index: out.length,
        date: `20${m[3]}-${m[2]}-${m[1]}`,
        time: `${m[4]}:${m[5]}`,
        author: m[7].replace(/ /g, ' ').replace(/^~\s*/, '').trim(),
        text: m[8],
      });
    } else if (out.length) {
      out[out.length - 1].text += '\n' + line;
    }
  }
  for (const m of out) m.text = m.text.replace(/<This message was edited>/g, '').trimEnd();
  return out;
}

const stamp = (m: ChatMessage) => `${m.date} ${m.time}`;
const byTime = (a: ListMsg, b: ListMsg) =>
  stamp(a.msg).localeCompare(stamp(b.msg)) || a.msg.index - b.msg.index;

// ---------------------------------------------------------------- lists

const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
const EMOJI_G = /[\p{Extended_Pictographic}\p{Regional_Indicator}️‍⃣\u{1F3FB}-\u{1F3FF}]/gu;
const BULLET = /^\s*(?:[-•*·–—▪●]|\d+\s*[.)])\s*(.*\S.*)$/;
const TENTATIVE = /\b(maybe|mungkin|hope|idk)\b|\?/i;
const CANCELLED = /\b(gabisa|gk bisa|ga bisa|batal|cancel|ga ikut|gajadi|ga jadi)\b/i;

export function nameCore(raw: string): string {
  return raw
    .replace(EMOJI_G, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\b(image|video|sticker|gif|audio|document) omitted\b/gi, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\+?\d{6,}/g, ' ') // account / phone numbers are never part of a name
    .toLowerCase()
    .replace(
      /\b(maybe|mungkin|i hope so|hope so|hope|idk|seh|centang|gabisa|gk bisa|ga bisa|telat|batal|cancel)\b/g,
      ' '
    )
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseList(msg: ChatMessage): ListMsg | null {
  const headerLines: string[] = [];
  const items: ListItem[] = [];
  for (const line of msg.text.split('\n')) {
    const b = BULLET.exec(line);
    if (b) {
      const raw = b[1].trim();
      const core = nameCore(raw);
      if (!core) continue;
      items.push({
        raw,
        core,
        marked: EMOJI.test(raw) || /\bcentang\b/i.test(raw),
        tentative: TENTATIVE.test(raw),
        cancelled: CANCELLED.test(raw),
      });
    } else if (!items.length) {
      headerLines.push(line.trim());
    }
  }
  if (items.length < 2) return null;
  return { msg, header: headerLines.filter(Boolean).join(' '), items };
}

// ---------------------------------------------------------------- price

const PRICE = /(\d[\d.,]*)\s*(k|rb)?\s*\/\s*(\d{1,2})(?!\d)(?:\s*=\s*(\d[\d.,]*)\s*(k|rb)?)?/i;

/** "327" -> 327000, "16,3" -> 16300, "1.200.000" -> 1200000. Small numbers are thousands. */
function toRupiah(text: string): number {
  let s = text.trim().replace(/[.,]+$/, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n < 10000 ? n * 1000 : n) : NaN;
}

export function parsePrice(text: string): PriceInfo | null {
  const m = PRICE.exec(text);
  if (!m) return null;
  const total = toRupiah(m[1]);
  const count = Number(m[3]);
  // "jam 6/7" is a time, not a price: real totals are at least Rp 40.000
  if (!(total >= 40000) || count < 2 || count > 60) return null;
  const per = m[4] ? toRupiah(m[4]) : NaN;
  return { total, count, perPerson: Number.isFinite(per) ? per : null };
}

// ---------------------------------------------------------------- dates

const DAYS: Record<string, number> = {
  minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, jumaat: 5, sabtu: 6,
};
const MONTHS: [RegExp, number][] = [
  [/^jan/, 0], [/^feb/, 1], [/^mar/, 2], [/^apr/, 3], [/^(mei|may)/, 4], [/^jun/, 5],
  [/^jul/, 6], [/^(agu|aug)/, 7], [/^sep/, 8], [/^(okt|oct)/, 9], [/^nov/, 10], [/^(des|dec)/, 11],
];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (s: string) => new Date(s + 'T12:00:00');
const addDays = (s: string, n: number) => {
  const d = at(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};

export interface ResolvedDate {
  date: string;
  how: 'explicit' | 'weekday';
}

/**
 * Work out which day a header means.
 * - "5 Okt" style dates are taken as written.
 * - A bare weekday ("sabtu") means the closest such day: `next` = on/after the
 *   message date (sign-ups), `prev` = on/before it (payments are asked afterwards).
 */
export function resolveDate(header: string, msgDate: string, dir: 'next' | 'prev'): ResolvedDate | null {
  const h = header.toLowerCase();

  const ex = /\b(\d{1,2})\s*(jan\w*|feb\w*|mar\w*|apr\w*|mei|may|jun\w*|jul\w*|agu\w*|aug\w*|sep\w*|okt\w*|oct\w*|nov\w*|des\w*|dec\w*)\b/.exec(h);
  if (ex) {
    const month = MONTHS.find(([re]) => re.test(ex[2]))?.[1];
    const day = Number(ex[1]);
    if (month !== undefined && day >= 1 && day <= 31) {
      const base = at(msgDate);
      let best: string | null = null;
      let bestDiff = Infinity;
      for (const y of [base.getFullYear() - 1, base.getFullYear(), base.getFullYear() + 1]) {
        const cand = iso(new Date(y, month, day, 12));
        const diff = Math.abs(at(cand).getTime() - base.getTime());
        if (diff < bestDiff) [best, bestDiff] = [cand, diff];
      }
      if (best) return { date: best, how: 'explicit' };
    }
  }

  const wd = /\b(senin|selasa|rabu|kamis|jumat|jum'at|jumaat|sabtu|minggu)\b/.exec(h);
  if (wd) {
    const target = DAYS[wd[1]];
    const base = at(msgDate);
    const have = base.getDay();
    let delta = dir === 'next' ? (target - have + 7) % 7 : -((have - target + 7) % 7);
    // "rabu depan" = next week's Wednesday, even if today is Wednesday
    if (dir === 'next' && /\bdepan\b/.test(h) && delta === 0) delta = 7;
    return { date: addDays(msgDate, delta), how: 'weekday' };
  }
  return null;
}

function parseTime(header: string, date: string): { start: string; end: string; guessed: boolean } | null {
  const m = /(?<![\d/])(\d{1,2})(?:[.:](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[.:](\d{2}))?(?![\d/])/.exec(header);
  if (!m) return null;
  let a = Number(m[1]);
  let b = Number(m[3]);
  if (a > 23 || b > 24 || a === b) return null;
  const weekend = [0, 6].includes(at(date).getDay());
  const evening = a >= 12 || /\b(malam|sore)\b/i.test(header);
  const morning = /\b(pagi)\b/i.test(header);
  const guessed = a < 12 && !evening && !morning;
  if (a < 12) {
    const am = morning || (a >= 9 && weekend && !evening);
    if (!am) {
      a += 12;
      b = b <= a - 12 ? b + 24 : b + 12;
    }
  }
  if (b <= a) b += 12;
  const fmt = (h: number, min?: string) => `${pad(h % 24)}:${min ?? '00'}`;
  return { start: fmt(a, m[2]), end: fmt(b, m[4]), guessed };
}

function parseLocation(header: string): string | null {
  const m = /📍\s*([^\d📍]*?)\s*(?=\d|$)/u.exec(header);
  const loc = m?.[1]?.trim().replace(/[,.;:]+$/, '').trim();
  return loc ? loc : null;
}

// ---------------------------------------------------------------- sessions

const isShuttlecock = (header: string) => /\b(kok|slop|slot kok)\b/i.test(header);
const normHeader = (h: string) => h.toLowerCase().replace(/\s+/g, ' ').replace(/\s*k\s*$/, '').trim();

interface PriceChain {
  header: string;
  msgs: ListMsg[];
  price: PriceInfo;
  /** the weekday / written date in the header, if any */
  token: string | null;
}

function dayToken(header: string): string | null {
  const h = header.toLowerCase();
  const ex = /\b(\d{1,2}\s*(?:jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)\w*)\b/.exec(h);
  if (ex) return ex[1].replace(/\s+/g, '').slice(0, 5);
  return /\b(senin|selasa|rabu|kamis|jumat|jum'at|jumaat|sabtu|minggu)\b/.exec(h)?.[1] ?? null;
}

const daysBetween = (a: string, b: string) => Math.abs(at(b).getTime() - at(a).getTime()) / 86_400_000;

export function analyseChat(raw: string): ParsedChat {
  const messages = parseMessages(raw);
  const lists = messages.map(parseList).filter((l): l is ListMsg => !!l);
  const listIdx = new Set(lists.map((l) => l.msg.index));

  // ---- split into price lists / shuttlecock lists / sign-up lists
  const chains: PriceChain[] = [];
  const kok = new Map<string, { header: string; date: string; count: number }>();
  const signups: ListMsg[] = [];
  for (const l of lists) {
    const price = parsePrice(l.header);
    if (price) {
      const key = normHeader(l.header);
      if (isShuttlecock(l.header)) {
        const k = kok.get(key);
        if (k) k.count++;
        else kok.set(key, { header: l.header, date: l.msg.date, count: 1 });
        continue;
      }
      // Same amount + same day word (or none) within 2 weeks = the same list being reposted.
      // (People re-post with extra words like "sabtu 8-10" in front, so don't compare the text.)
      const token = dayToken(l.header);
      const c = chains.find(
        (x) =>
          x.price.total === price.total &&
          x.price.count === price.count &&
          (x.token === null || token === null || x.token === token) &&
          daysBetween(x.msgs.at(-1)!.msg.date, l.msg.date) <= 14
      );
      if (c) {
        c.msgs.push(l);
        c.token ??= token;
      } else chains.push({ header: l.header, msgs: [l], price, token });
    } else if (resolveDate(l.header, l.msg.date, 'next')) {
      signups.push(l);
    }
  }

  // ---- sessions from sign-up lists, one per day
  const byDate = new Map<string, SessionDraft>();
  const keys = new Set<string>();
  const blank = (date: string, how: SessionDraft['dateHow']): SessionDraft => {
    // stable id: the date, or date-2 for a second payment on the same day
    let key = date;
    for (let n = 2; keys.has(key); n++) key = `${date}-${n}`;
    keys.add(key);
    return { ...empty(date, how), key };
  };
  const signupLists = new Map<string, ListMsg[]>();
  const empty = (date: string, how: SessionDraft['dateHow']): SessionDraft => ({
    key: date, date, dateHow: how, start: null, end: null, timeGuessed: false,
    location: null, signupCount: 0, finalSignup: null, priceMsgs: [], reposts: [], priceHeader: null, price: null,
    priceFirst: null, priceLast: null, participants: [], priceHints: [], warnings: [],
  });
  for (const l of [...signups].sort(byTime)) {
    const r = resolveDate(l.header, l.msg.date, 'next')!;
    const s = byDate.get(r.date) ?? blank(r.date, r.how === 'explicit' ? 'explicit' : 'weekday');
    byDate.set(r.date, s);
    signupLists.set(s.key, [...(signupLists.get(s.key) ?? []), l]);
  }

  // ---- attach each payment chain to a session
  const extra: SessionDraft[] = [];
  const taken = new Set<string>();
  const ordered = [...chains].sort((a, b) => byTime(a.msgs[0], b.msgs[0]));
  for (const chain of ordered) {
    const first = chain.msgs[0];
    const r = resolveDate(chain.header, first.msg.date, 'prev');
    let session: SessionDraft | undefined;
    let how: SessionDraft['dateHow'] = 'price-header';
    if (r) {
      session = byDate.get(r.date);
      if (session && taken.has(session.key)) session = undefined; // second payment for the same day
      if (!session) {
        session = blank(r.date, r.how === 'explicit' ? 'explicit' : 'price-header');
        extra.push(session);
      }
    } else {
      // no day in the header ("245/11 =22k"): the latest unpaid session before this message
      const cands = [...byDate.values()]
        .filter((s) => s.date <= first.msg.date && !taken.has(s.key))
        .sort((a, b) => b.date.localeCompare(a.date));
      session = cands[0];
      how = 'matched';
      if (!session) continue;
    }
    taken.add(session.key);
    session.dateHow = signupLists.get(session.key)?.length || how === 'matched' ? session.dateHow : how;
    if (how === 'matched') session.dateHow = 'matched';
    session.priceMsgs = chain.msgs;
    session.priceHeader = chain.header;
    session.price = chain.price;
  }

  const sessions = [...byDate.values(), ...extra].sort((a, b) => a.date.localeCompare(b.date));

  // ---- fill in details
  for (const s of sessions) {
    const signupMsgs = (signupLists.get(s.key) ?? []).sort(byTime);
    s.signupCount = signupMsgs.length;
    s.reposts = [...s.priceMsgs].sort(byTime).map((l) => ({
      author: l.msg.author, date: l.msg.date, time: l.msg.time, marks: l.items.filter((i) => i.marked).length,
    }));
    const allHeaders = [...signupMsgs, ...s.priceMsgs].map((l) => l.header);
    const timeSrc = [s.priceHeader ?? '', ...allHeaders.reverse()];
    for (const h of timeSrc) {
      const t = parseTime(h, s.date);
      if (t) {
        [s.start, s.end, s.timeGuessed] = [t.start, t.end, t.guessed];
        break;
      }
    }
    s.location = timeSrc.map(parseLocation).find(Boolean) ?? null;

    const priceFirstAt = s.priceMsgs.length ? stamp([...s.priceMsgs].sort(byTime)[0].msg) : null;
    const before = priceFirstAt ? signupMsgs.filter((l) => stamp(l.msg) <= priceFirstAt) : signupMsgs;
    s.finalSignup = (before.length ? before : signupMsgs).at(-1) ?? null;

    if (s.priceMsgs.length) {
      const sorted = [...s.priceMsgs].sort(byTime);
      s.priceFirst = sorted[0];
      const marks = (l: ListMsg) => l.items.filter((i) => i.marked).length;
      s.priceLast = sorted.reduce((best, l) => (marks(l) >= marks(best) ? l : best), sorted[0]);
    }

    // ---- participants
    const draft = new Map<string, ParticipantDraft>();
    const blankP = (core: string): ParticipantDraft => ({
      core, tentative: false, cancelled: false, paid: false, paidBy: null,
      markedInOriginal: false, addedLater: false, paidForCourt: false,
    });
    if (s.priceMsgs.length) {
      const sorted = [...s.priceMsgs].sort(byTime);
      const firstCores = new Set(sorted[0].items.map((i) => i.core));
      for (const l of sorted) {
        for (const it of l.items) {
          const p = draft.get(it.core) ?? { ...blankP(it.core), addedLater: !firstCores.has(it.core) };
          draft.set(it.core, p);
          p.tentative ||= it.tentative;
          p.cancelled ||= it.cancelled;
          if (it.marked && !p.paid) {
            p.paid = true;
            p.paidBy = { author: l.msg.author, date: l.msg.date, time: l.msg.time };
            p.markedInOriginal = l === sorted[0];
          }
        }
      }
      // paid for the court themselves: on the sign-up list, missing from the payment list
      for (const it of s.finalSignup?.items ?? []) {
        if (draft.has(it.core) || it.cancelled || it.tentative) continue;
        if (/^(karyna|kare|christian|chris)\b/.test(it.core)) {
          draft.set(it.core, { ...blankP(it.core), paid: true, paidForCourt: true });
        }
      }
      if (s.price && draft.size !== s.price.count) {
        s.warnings.push(`Price is split between ${s.price.count} people but I found ${draft.size} names.`);
      }
    } else if (s.finalSignup) {
      for (const it of s.finalSignup.items) {
        draft.set(it.core, { ...blankP(it.core), tentative: it.tentative, cancelled: it.cancelled });
      }
    }
    s.participants = [...draft.values()];

    // ---- price mentioned in plain sentences (sessions without a payment list)
    if (!s.price) {
      const lo = s.date;
      const hi = addDays(s.date, 5);
      s.priceHints = messages.filter(
        (m) => m.date >= lo && m.date <= hi && m.text.length < 220 && !listIdx.has(m.index) &&
          !isShuttlecock(m.text) && !!parsePrice(m.text)
      );
    }
    if (s.timeGuessed) s.warnings.push('AM/PM was guessed from the header: check the time.');
  }

  return {
    messages: messages.length,
    firstDate: messages[0]?.date ?? '',
    lastDate: messages.at(-1)?.date ?? '',
    sessions,
    skippedShuttlecock: [...kok.values()],
  };
}
