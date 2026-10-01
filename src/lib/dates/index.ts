// Calendar helpers on "YYYY-MM-DD" strings. Every date is a UTC calendar day,
// matching the PostHog projects (both run on UTC).

export type ISODate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isISODate(value: string): value is ISODate {
  return ISO_DATE.test(value) && formatISODate(toUTCDate(value)) === value;
}

export function toUTCDate(iso: ISODate): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function formatISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function todayUTC(now: Date = new Date()): ISODate {
  return formatISODate(now);
}

export function addDays(iso: ISODate, days: number): ISODate {
  return formatISODate(new Date(toUTCDate(iso).getTime() + days * DAY_MS));
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((toUTCDate(to).getTime() - toUTCDate(from).getTime()) / DAY_MS);
}

export function dayRange(start: ISODate, count: number): ISODate[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** Monday of the week containing `iso` (Monday-start weeks). */
export function mondayOf(iso: ISODate): ISODate {
  const weekday = toUTCDate(iso).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((weekday + 6) % 7));
}

/** `count` Monday-start weeks, oldest first, ending with the week containing `end`. */
export function mondayWeeks(end: ISODate, count: number): ISODate[] {
  const last = mondayOf(end);
  return Array.from({ length: count }, (_, i) => addDays(last, (i - count + 1) * 7));
}

// Fixed abbreviations: Intl output varies by ICU version ("Sep" vs "Sept").
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1 Oct" */
export function formatDayMonth(iso: ISODate): string {
  const date = toUTCDate(iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** "17–30 Sep" or "28 Sep – 4 Oct" */
export function formatDayRange(start: ISODate, end: ISODate): string {
  const [startDay, startMonth] = formatDayMonth(start).split(" ");
  const [endDay, endMonth] = formatDayMonth(end).split(" ");
  return startMonth === endMonth
    ? `${startDay}–${endDay} ${endMonth}`
    : `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}
