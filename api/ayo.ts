import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * /api/ayo: reads court availability from AYO (ayo.co) for the Courts page.
 *
 * Browsers can't call ayo.co directly (it doesn't allow other sites to), so this small
 * server function fetches it for us. On Vercel it runs as a serverless function; in
 * `npm run dev` the same handler is mounted by vite.config.ts.
 *
 *   GET /api/ayo?slug=weston-sports           -> { venueId, slug, name }
 *   GET /api/ayo?venue=728&date=2026-11-16    -> { venueId, date, courts: [...] }
 *
 * It only ever talks to ayo.co and only accepts a venue slug, a venue number and a date,
 * so it can't be used to fetch anything else. Keep this file self-contained (no imports
 * from src/): Vercel builds it on its own.
 */

const AYO = 'https://ayo.co';
const BADMINTON_SPORT_ID = 4;
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'Accept-Language': 'en,id;q=0.8',
};

export interface AyoSlot {
  /** "08:00" */
  start: string;
  /** "09:00"; "24:00" when the slot ends at midnight */
  end: string;
  /** whole Rupiah for this slot */
  price: number;
  available: boolean;
}

export interface AyoCourt {
  id: number;
  name: string;
  slots: AyoSlot[];
}

export interface AyoAvailability {
  venueId: number;
  date: string;
  /** false when the venue is closed that day */
  open: boolean;
  /** badminton courts only */
  courts: AyoCourt[];
}

export interface AyoVenueInfo {
  venueId: number;
  slug: string;
  name: string;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function ayoFetch(url: string, accept: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { ...HEADERS, Accept: accept, 'X-Requested-With': 'XMLHttpRequest' },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new HttpError(502, 'Could not reach AYO. Try again in a moment.');
  }
  if (res.status === 404) throw new HttpError(404, 'AYO does not know this venue.');
  if (!res.ok) throw new HttpError(502, `AYO answered with an error (${res.status}).`);
  return res;
}

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/** Venue page -> its AYO number and name. */
async function lookupVenue(slug: string): Promise<AyoVenueInfo> {
  const html = await (await ayoFetch(`${AYO}/v/${slug}`, 'text/html')).text();
  const id = /venues-ajax\/(\d+)\/get-field-list/.exec(html) ?? /venue_id\s*=\s*`(\d+)`/.exec(html);
  if (!id) throw new HttpError(404, 'That link does not look like an AYO venue page.');
  const name =
    /<h1[^>]*class="[^"]*venue-name[^"]*"[^>]*>([^<]+)/.exec(html)?.[1] ??
    /og:title" content="(?:Booking lapangan )?([^"]+)"/i.exec(html)?.[1] ??
    slug;
  return { venueId: Number(id[1]), slug, name: decodeEntities(name) };
}

interface RawSlot {
  start_time: string;
  end_time: string;
  price: number;
  is_available: number;
  start_date_time: string;
}
interface RawField {
  field_id: number;
  field_name: string;
  sport_id: number;
  slots?: RawSlot[];
}

/** Current time in Surabaya/Jakarta (UTC+7, no daylight saving) as "YYYY-MM-DD HH:MM:SS". */
function nowInWib(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
}

async function getAvailability(venueId: number, date: string): Promise<AyoAvailability> {
  const res = await ayoFetch(
    `${AYO}/venues-ajax/op-times-and-fields?venue_id=${venueId}&date=${date}`,
    'application/json'
  );
  let data: { op_time?: { is_open?: boolean }; fields?: RawField[] };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new HttpError(502, 'AYO sent something unexpected.');
  }
  const now = nowInWib();
  const courts = (data.fields ?? [])
    .filter((f) => f.sport_id === BADMINTON_SPORT_ID)
    .map((f) => ({
      id: f.field_id,
      name: f.field_name,
      slots: (f.slots ?? []).map((s) => {
        const end = s.end_time.slice(0, 5);
        return {
          start: s.start_time.slice(0, 5),
          end: end === '00:00' ? '24:00' : end,
          price: Number(s.price) || 0,
          // slots that already started can't be booked any more
          available: Number(s.is_available) === 1 && s.start_date_time > now,
        };
      }),
    }));
  return { venueId, date, open: data.op_time?.is_open !== false, courts };
}

async function route(params: URLSearchParams): Promise<AyoVenueInfo | AyoAvailability> {
  const slug = params.get('slug');
  if (slug !== null) {
    if (!/^[a-z0-9][a-z0-9-]{0,80}$/i.test(slug)) throw new HttpError(400, 'Bad venue link.');
    return lookupVenue(slug.toLowerCase());
  }
  const venue = params.get('venue') ?? '';
  const date = params.get('date') ?? '';
  if (!/^\d{1,9}$/.test(venue) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, 'Expected ?slug=… or ?venue=<number>&date=YYYY-MM-DD');
  }
  return getAvailability(Number(venue), date);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const params = new URL(req.url ?? '/', 'http://localhost').searchParams;
  let status = 200;
  let body: unknown;
  try {
    body = await route(params);
  } catch (e) {
    status = e instanceof HttpError ? e.status : 500;
    body = { error: e instanceof HttpError ? e.message : 'Something went wrong reading AYO.' };
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // let Vercel's CDN reuse an answer for a minute so quick re-searches don't hit AYO again
  res.setHeader('Cache-Control', status === 200 ? 'public, s-maxage=60, max-age=30' : 'no-store');
  res.end(JSON.stringify(body));
}
