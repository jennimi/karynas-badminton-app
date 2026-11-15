/** Today as YYYY-MM-DD in the user's local time zone. */
export function todayString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

export function formatDate(
  dateStr: string,
  style: 'short' | 'long' = 'short'
): string {
  return parseDate(dateStr).toLocaleDateString('en-GB', {
    weekday: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
  });
}

export function dateParts(dateStr: string): { day: string; month: string } {
  const d = parseDate(dateStr);
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString('en-GB', { month: 'short' }),
  };
}

/** "7:00 PM" from "19:00:00" or "19:00". */
export function formatTime(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export function formatTimeRange(start: string | null, end: string | null) {
  if (!start) return '';
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

/** "Today", "Tomorrow", "In 3 days", "Yesterday", "5 days ago". */
export function relativeDay(dateStr: string): string {
  const today = parseDate(todayString()).getTime();
  const diff = Math.round((parseDate(dateStr).getTime() - today) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
}

/** `dateStr` shifted by `n` days (negative = earlier), as YYYY-MM-DD. */
export function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "1 court", "3 courts". */
export function formatCourts(n: number): string {
  return `${n} court${n === 1 ? '' : 's'}`;
}

export function isUpcoming(dateStr: string): boolean {
  return dateStr >= todayString();
}

/** Currency used for session costs (Indonesian Rupiah). */
export const CURRENCY_SYMBOL = 'Rp';

const money = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 });

/** "Rp 150.000", "Rp 33.333,333" (Indonesian format, up to 3 decimals). `amount` is in whole Rupiah. */
export function formatMoney(amount: number): string {
  return `${CURRENCY_SYMBOL} ${money.format(amount)}`;
}

/**
 * Session costs are stored and typed in THOUSANDS of Rupiah: 208 means Rp 208.000.
 * (Database: sessions.total_cost, see migration 008.) Use formatCost to show one.
 */
export const COST_UNIT = 1000;

/**
 * Shows a cost in its own unit (thousands), so the number stays short: a whole total like
 * 530 reads "Rp 530", and a per-person split keeps up to whole-Rupiah precision —
 * formatCost(530 / 19) = "Rp 27,895" (the comma is the decimal point; 894 = 894 Rupiah),
 * dropping the useless fraction of a Rupiah. See migration 008 for why costs are in thousands.
 */
export function formatCost(thousands: number): string {
  return `${CURRENCY_SYMBOL} ${money.format(thousands)}`;
}
