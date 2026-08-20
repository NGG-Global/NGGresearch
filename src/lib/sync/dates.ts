/** UTC date helpers. YouTube report dates are calendar days, not instants. */

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function fromDateString(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function addDaysToString(value: string, days: number): string {
  return toDateString(addDays(fromDateString(value), days));
}

/** Inclusive list of calendar dates between two date strings. */
export function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = fromDateString(start);
  const last = fromDateString(end);
  while (cursor.getTime() <= last.getTime()) {
    dates.push(toDateString(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/**
 * Number of whole calendar days a milestone spans.
 * 24h -> 1 day, 72h -> 3 days, 7d -> 7 days.
 */
export function milestoneDayCount(ageHours: number): number {
  return Math.max(1, Math.round(ageHours / 24));
}
