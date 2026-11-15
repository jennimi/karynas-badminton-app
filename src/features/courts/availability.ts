// Turning AYO's raw slots into "which courts are free for my game".
// No network or React in here: just the search rules.

export interface Slot {
  /** "08:00" */
  start: string;
  /** "09:00"; "24:00" when the slot ends at midnight */
  end: string;
  /** whole Rupiah */
  price: number;
  available: boolean;
}

export interface Court {
  id: number;
  name: string;
  slots: Slot[];
}

export interface Availability {
  venueId: number;
  date: string;
  open: boolean;
  courts: Court[];
}

export interface SearchInput {
  /** "08:00" */
  start: string;
  /** false = only that start time; true = that time or any later one */
  orLater: boolean;
  durationMinutes: number;
  /** how many courts the group wants at the same time */
  courtsWanted: number;
  players: number;
}

export interface FreeCourt {
  id: number;
  name: string;
  /** whole Rupiah for the full duration on this court */
  price: number;
}

/** One possible start time at a venue. */
export interface Option {
  start: string;
  end: string;
  /** courts free for the whole duration, cheapest first */
  courts: FreeCourt[];
  /** true when at least `courtsWanted` courts are free */
  enough: boolean;
  /** cost of the cheapest `courtsWanted` courts (or of all free ones when there aren't enough) */
  total: number;
  perPerson: number;
}

export const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Price of `court` from `start` for `duration` minutes, or null if any part of it is taken.
 * Slots are chained back to back (08–09 + 09–10); a slot that runs past the end doesn't count,
 * because booking it would mean paying for more time than asked.
 */
function priceFor(court: Court, start: number, duration: number): number | null {
  const end = start + duration;
  let t = start;
  let total = 0;
  while (t < end) {
    const slot = court.slots.find((s) => s.available && toMinutes(s.start) === t);
    if (!slot) return null;
    const slotEnd = toMinutes(slot.end);
    if (slotEnd <= t || slotEnd > end) return null;
    total += slot.price;
    t = slotEnd;
  }
  return total;
}

function optionAt(courts: Court[], start: number, input: SearchInput): Option {
  const free: FreeCourt[] = [];
  for (const c of courts) {
    const price = priceFor(c, start, input.durationMinutes);
    if (price !== null) free.push({ id: c.id, name: c.name, price });
  }
  free.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, undefined, { numeric: true }));
  const counted = free.slice(0, input.courtsWanted);
  const total = counted.reduce((sum, c) => sum + c.price, 0);
  return {
    start: toTime(start),
    end: toTime(start + input.durationMinutes),
    courts: free,
    enough: free.length >= input.courtsWanted,
    total,
    perPerson: input.players > 0 ? total / input.players : total,
  };
}

/**
 * Start times at one venue that fit the search, earliest first.
 * - exact time: always one option (it may have too few or no courts, so the page can say so)
 * - "or later": only the start times with enough courts
 */
export function findOptions(availability: Availability, input: SearchInput): Option[] {
  const from = toMinutes(input.start);
  if (!input.orLater) return [optionAt(availability.courts, from, input)];

  const starts = new Set<number>();
  for (const c of availability.courts) {
    for (const s of c.slots) {
      const m = toMinutes(s.start);
      if (s.available && m >= from) starts.add(m);
    }
  }
  return [...starts]
    .sort((a, b) => a - b)
    .map((s) => optionAt(availability.courts, s, input))
    .filter((o) => o.enough);
}
