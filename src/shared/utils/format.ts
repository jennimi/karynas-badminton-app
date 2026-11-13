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

export function isUpcoming(dateStr: string): boolean {
  return dateStr >= todayString();
}
