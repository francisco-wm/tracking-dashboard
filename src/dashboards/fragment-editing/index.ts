import type { DashboardModule } from "@/dashboards/types";
import { formatDayRange } from "@/lib/dates";

import { DASHBOARD_SLUG } from "./config";
import { controls } from "./controls";
import { derivePeriod, parseFilters } from "./filters";
import { completion } from "./sections/completion";
import { editsListed } from "./sections/edits-listed";

export const fragmentEditing: DashboardModule = {
  slug: DASHBOARD_SLUG,
  title: "Fragment editing",
  description:
    "Do edits to listed fragments reach readers? Edits listed next to new knowledge, and how many started edits get listed.",
  headerNote(ctx) {
    const filters = parseFilters(ctx.searchParams);
    const period = derivePeriod(ctx.today, filters.days);
    const who = filters.excludeInternal
      ? "internal users excluded"
      : "everyone counted, including internal users";
    return `${formatDayRange(period.start, period.end)} ${period.end.slice(0, 4)} · ${who}`;
  },
  controls,
  sections: [editsListed, completion],
};
