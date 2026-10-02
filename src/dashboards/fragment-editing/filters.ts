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
  /** First day counted. */
  start: ISODate;
  /** Today, inclusive. It is still in progress. */
  end: ISODate;
  /** Every day of the period, oldest first; the last one is today. */
  dates: ISODate[];
}

/** The last `days` days, today included. */
export function derivePeriod(today: ISODate, days: RangeDays): Period {
  const start = addDays(today, -(days - 1));
  return { days, start, end: today, dates: dayRange(start, days) };
}

/** Position of `date` on the period's timelines; -1 outside the period. */
export function dayIndex(period: Period, date: ISODate): number {
  if (date < period.start || date > period.end) return -1;
  return diffDays(period.start, date);
}

/** Share of started edits that got listed; null when nothing was started. */
export function completionRate(listed: number, started: number): number | null {
  return started > 0 ? listed / started : null;
}
