import type { DashboardModule } from "@/dashboards/types";
import { formatDayRange } from "@/lib/dates";

import { DASHBOARD_SLUG } from "./config";
import { controls } from "./controls";
import { derivePeriod, parseFilters } from "./filters";
import { followThrough } from "./sections/follow-through";
import { interactions } from "./sections/interactions";
import { reliability } from "./sections/reliability";

export const homeWidgets: DashboardModule = {
  slug: DASHBOARD_SLUG,
  title: "Home widgets",
  description:
    "How people use the widgets on the organisation home page: clicks per widget, whether drafts opened or started there get listed, and failed loads.",
  headerNote(ctx) {
    const filters = parseFilters(ctx.searchParams);
    const period = derivePeriod(ctx.today, filters.days);
    const who = filters.excludeInternal
      ? "internal users excluded"
      : "everyone counted, including internal users";
    return `${formatDayRange(period.start, period.end)} ${period.end.slice(0, 4)} · ${who}`;
  },
  controls,
  sections: [interactions, followThrough, reliability],
};
