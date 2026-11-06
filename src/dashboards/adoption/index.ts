import type { DashboardModule } from "@/dashboards/types";
import { formatDayRange } from "@/lib/dates";

import { DASHBOARD_SLUG } from "./config";
import { controls } from "./controls";
import { derivePeriod, parseFilters } from "./filters";
import { activePeople } from "./sections/active-people";
import { activity } from "./sections/activity";
import { newPeopleSection } from "./sections/new-people";
import { organisationsSection } from "./sections/organisations";

export const adoption: DashboardModule = {
  slug: DASHBOARD_SLUG,
  title: "Adoption",
  description:
    "Is wingmaite being adopted? Weekly active people, who comes back after their first two weeks, and knowledge requests per active person.",
  headerNote(ctx) {
    const filters = parseFilters(ctx.searchParams);
    const period = derivePeriod(ctx.today, filters.weeks);
    const who = filters.excludeInternal
      ? "internal users excluded"
      : "everyone counted, including internal users";
    return `${formatDayRange(period.start, period.end)} ${period.end.slice(0, 4)} · ${who}`;
  },
  controls,
  sections: [activePeople, newPeopleSection, activity, organisationsSection],
};
