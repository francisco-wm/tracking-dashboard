import type { DashboardContext } from "@/dashboards/types";
import { hrefWith } from "@/lib/url";

import { FilterControls } from "./filter-controls";
import { filterParams, parseFilters, RANGE_DAYS, type Filters } from "./filters";

/** Server side: work out every link, so the client only navigates. */
export function controls(ctx: DashboardContext, path: string) {
  const filters = parseFilters(ctx.searchParams);
  const href = (next: Filters) => hrefWith(path, ctx.searchParams, filterParams(next));
  return (
    <FilterControls
      range={String(filters.days)}
      rangeOptions={RANGE_DAYS.map((days) => ({
        value: String(days),
        label: `Last ${days} days`,
        href: href({ ...filters, days }),
      }))}
      includeInternal={!filters.excludeInternal}
      includeHref={href({ ...filters, excludeInternal: false })}
      excludeHref={href({ ...filters, excludeInternal: true })}
    />
  );
}
