import type { SearchParams } from "@/dashboards/types";
import { addDays, dayRange, diffDays, type ISODate } from "@/lib/dates";

export const RANGE_DAYS = [30, 90, 180] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];
export const DEFAULT_RANGE: RangeDays = 90;

/** The viewer's choices, carried in the URL (?range=30, ?internal=exclude). */
export interface Filters {
  days: RangeDays;
  /** Off by default: everyone is counted unless the viewer asks otherwise. */
  excludeInternal: boolean;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Unknown or missing values fall back to the defaults. */
export function parseFilters(params: SearchParams): Filters {
  const range = Number(first(params.range));
  const days = (RANGE_DAYS as readonly number[]).includes(range) ? (range as RangeDays) : DEFAULT_RANGE;
  return { days, excludeInternal: first(params.internal) === "exclude" };
}

/** URL overrides for a filter state. Defaults are left out so links stay short. */
export function filterParams(filters: Filters): Record<string, string | null> {
  return {
    range: filters.days === DEFAULT_RANGE ? null : String(filters.days),
    internal: filters.excludeInternal ? "exclude" : null,
  };
}

export interface Period {
  days: RangeDays;
  /** First day of the range. */
  start: ISODate;
  /** Today, inclusive. It is still in progress. */
  end: ISODate;
  /** First day counted: the range's start, or the day the tracking started if that is later. */
  from: ISODate;
  /** Every counted day, oldest first; the last one is today. */
  dates: ISODate[];
}

/** The last `days` days, today included, counted from no earlier than `trackingStarted`. */
export function derivePeriod(
  today: ISODate,
  days: RangeDays,
  trackingStarted: ISODate | null = null,
): Period {
  const start = addDays(today, -(days - 1));
  const from = trackingStarted !== null && trackingStarted > start ? trackingStarted : start;
  return { days, start, end: today, from, dates: dayRange(from, Math.max(0, diffDays(from, today) + 1)) };
}

/** The day the tracking started, when the range reaches back before it; otherwise null. */
export function trackedSince(period: Period): ISODate | null {
  return period.from > period.start ? period.from : null;
}

/** part / whole; null when there is nothing to divide by. */
export function share(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}
