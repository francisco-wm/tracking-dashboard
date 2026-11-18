import type { DashboardContext } from "@/dashboards/types";
import { hrefWith } from "@/lib/url";

import { FilterControls } from "../adoption/filter-controls";
import { RANGE_WEEKS } from "../adoption/filters";
import { filterParams, parseFilters, type Filters } from "./filters";

/** Server side: work out every link, so the client only navigates. */
export function controls(ctx: DashboardContext, path: string) {
  const filters = parseFilters(ctx.searchParams);
  const href = (next: Filters) => hrefWith(path, ctx.searchParams, filterParams(next));
  return (
    <FilterControls
      range={String(filters.weeks)}
      rangeOptions={RANGE_WEEKS.map((weeks) => ({
        value: String(weeks),
        label: `Last ${weeks} weeks`,
        href: href({ ...filters, weeks }),
      }))}
      includeInternal={!filters.excludeInternal}
      includeHref={href({ ...filters, excludeInternal: false })}
      excludeHref={href({ ...filters, excludeInternal: true })}
    />
  );
}
