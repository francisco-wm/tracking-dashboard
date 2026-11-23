import type { DashboardContext } from "@/dashboards/types";
import { hrefWith } from "@/lib/url";

import { FilterControls } from "./filter-controls";
import { filterParams, parseFilters } from "./filters";

/** Server side: work out every link, so the client only navigates. */
export function controls(ctx: DashboardContext, path: string) {
  const filters = parseFilters(ctx.searchParams);
  const href = (excludeInternal: boolean) =>
    hrefWith(path, ctx.searchParams, filterParams({ excludeInternal }));
  return (
    <FilterControls
      includeInternal={!filters.excludeInternal}
      includeHref={href(false)}
      excludeHref={href(true)}
    />
  );
}
