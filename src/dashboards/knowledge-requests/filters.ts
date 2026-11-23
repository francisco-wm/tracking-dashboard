import type { SearchParams } from "@/dashboards/types";
import { addDays, dayRange, diffDays, type ISODate } from "@/lib/dates";

export const RANGE_DAYS = [30, 90, 180] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];
export const DEFAULT_RANGE: RangeDays = 90;

/** The viewer's choices, carried in the URL (?range=30, ?internal=include). */
export interface Filters {
  days: RangeDays;
  /** On by default: internal users are left out unless the viewer asks. */
  excludeInternal: boolean;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Unknown or missing values fall back to the defaults. */
export function parseFilters(params: SearchParams): Filters {
  const range = Number(first(params.range));
  const days = (RANGE_DAYS as readonly number[]).includes(range) ? (range as RangeDays) : DEFAULT_RANGE;
  return { days, excludeInternal: first(params.internal) !== "include" };
}

/** URL overrides for a filter state. Defaults are left out so links stay short. */
export function filterParams(filters: Filters): Record<string, string | null> {
  return {
    range: filters.days === DEFAULT_RANGE ? null : String(filters.days),
    internal: filters.excludeInternal ? null : "include",
  };
}

/** A moment in UTC, to the hour: when a project's tracking started. */
export interface StartedAt {
  date: ISODate;
  /** 0–23. */
  hour: number;
}

export interface Period {
  days: RangeDays;
  /** First day of the range. */
  start: ISODate;
  /** Today, inclusive. It is still in progress. */
  end: ISODate;
  /** First day counted: the range's start, or the day the tracking started if that is later. */
  from: ISODate;
  /** The UTC hour counting starts at on `from`: the tracking start's, when it falls on that day; otherwise 0. */
  fromHour: number;
  /** Every counted day, oldest first; the last one is today. */
  dates: ISODate[];
}

/** The last `days` days, today included, counted from no earlier than `trackingStarted`. */
export function derivePeriod(
  today: ISODate,
  days: RangeDays,
  trackingStarted: StartedAt | null = null,
): Period {
  const start = addDays(today, -(days - 1));
  const { date: from, hour: fromHour } =
    trackingStarted !== null && trackingStarted.date >= start ? trackingStarted : { date: start, hour: 0 };
  return {
    days,
    start,
    end: today,
    from,
    fromHour,
    dates: dayRange(from, Math.max(0, diffDays(from, today) + 1)),
  };
}

/** The day the tracking started, when the range reaches back before it (to the hour); otherwise null. */
export function trackedSince(period: Period): ISODate | null {
  return period.from > period.start || period.fromHour > 0 ? period.from : null;
}

/** "18:00" when counting starts partway through the first day; null when it starts at midnight. */
export function startTime(period: Period): string | null {
  return period.fromHour > 0 ? `${String(period.fromHour).padStart(2, "0")}:00` : null;
}

/** The first counted moment as a HogQL datetime in UTC, e.g. "2026-10-28 18:00:00". */
export function countedFrom(period: Period): string {
  return `${period.from} ${startTime(period) ?? "00:00"}:00`;
}

/** part / whole; null when there is nothing to divide by. */
export function share(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}
