import type { SearchParams } from "@/dashboards/types";

/** The viewer's choices, carried in the URL (?internal=include). */
export interface Filters {
  /** On by default: internal users are left out unless the viewer asks. */
  excludeInternal: boolean;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseFilters(params: SearchParams): Filters {
  return { excludeInternal: first(params.internal) !== "include" };
}

/** URL overrides for a filter state. Defaults are left out so links stay short. */
export function filterParams(filters: Filters): Record<string, string | null> {
  return { internal: filters.excludeInternal ? null : "include" };
}
