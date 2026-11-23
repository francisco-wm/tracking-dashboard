import type { SearchParams } from "@/dashboards/types";
import { addDays, mondayOf, mondayWeeks, type ISODate } from "@/lib/dates";

import { PER_PEOPLE } from "./config";

export const RANGE_WEEKS = [13, 26, 52] as const;
export type RangeWeeks = (typeof RANGE_WEEKS)[number];
export const DEFAULT_RANGE: RangeWeeks = 26;

/** The viewer's choices, carried in the URL (?range=52, ?internal=include). */
export interface Filters {
  weeks: RangeWeeks;
  /** On by default: internal users are left out unless the viewer asks. */
  excludeInternal: boolean;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Unknown or missing values fall back to the defaults. */
export function parseFilters(params: SearchParams): Filters {
  const range = Number(first(params.range));
  const weeks = (RANGE_WEEKS as readonly number[]).includes(range) ? (range as RangeWeeks) : DEFAULT_RANGE;
  return { weeks, excludeInternal: first(params.internal) !== "include" };
}

/** URL overrides for a filter state. Defaults are left out so links stay short. */
export function filterParams(filters: Filters): Record<string, string | null> {
  return {
    range: filters.weeks === DEFAULT_RANGE ? null : String(filters.weeks),
    internal: filters.excludeInternal ? null : "include",
  };
}

export interface Period {
  weeks: RangeWeeks;
  /** Monday of every week, oldest first. The last one is this week. */
  mondays: ISODate[];
  /** First day counted: the first week's Monday. */
  start: ISODate;
  /** Today, inclusive. It is still in progress. */
  end: ISODate;
  /** This week, still in progress, so it is drawn lighter. */
  thisWeek: ISODate;
  /** The latest complete week: headline numbers use it. */
  lastWeek: ISODate;
}

/** The last `weeks` Monday weeks, this one included. */
export function derivePeriod(today: ISODate, weeks: RangeWeeks): Period {
  const mondays = mondayWeeks(today, weeks);
  const thisWeek = mondayOf(today);
  return { weeks, mondays, start: mondays[0], end: today, thisWeek, lastWeek: addDays(thisWeek, -7) };
}

/** Position of the week containing `date`; -1 outside the period. */
export function weekIndex(period: Period, date: ISODate): number {
  return period.mondays.indexOf(mondayOf(date));
}

/**
 * Trailing mean of the `window` weeks ending at each week. null until a full
 * window exists, and for the last week, which is still in progress: its partial
 * count would drag the average down.
 */
export function trailingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, i) =>
    i < window - 1 || i === values.length - 1
      ? null
      : values.slice(i - window + 1, i + 1).reduce((sum, v) => sum + v, 0) / window,
  );
}

/** `part` of `whole`; null when `whole` is 0. */
export function share(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

/** Events per PER_PEOPLE active people; null when nobody was active. */
export function perActive(count: number, active: number): number | null {
  return active > 0 ? (count / active) * PER_PEOPLE : null;
}
