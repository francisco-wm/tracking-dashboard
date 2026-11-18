import type { SearchParams } from "@/dashboards/types";

// ponytail: v2 reuses v1's weeks and helpers; move them here when v1 is retired.
import { DEFAULT_RANGE, RANGE_WEEKS, type RangeWeeks } from "../adoption/filters";

export { derivePeriod, share, trailingAverage, weekIndex, type Period } from "../adoption/filters";

/** The viewer's choices, carried in the URL (?range=52, ?internal=include). */
export interface Filters {
  weeks: RangeWeeks;
  /** On by default for this dashboard: internal users are left out unless the viewer asks. */
  excludeInternal: boolean;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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
