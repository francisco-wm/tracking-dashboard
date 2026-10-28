import type { DashboardModule } from "@/dashboards/types";
import { formatDayRange } from "@/lib/dates";

import { DASHBOARD_SLUG, TRACKING_STARTED } from "./config";
import { controls } from "./controls";
import { derivePeriod, parseFilters } from "./filters";
import { answers } from "./sections/answers";
import { closingSection } from "./sections/closing";
import { gaps } from "./sections/gaps";
import { overview } from "./sections/overview";
import { routingSection } from "./sections/routing";

export const knowledgeRequests: DashboardModule = {
  slug: DASHBOARD_SLUG,
  title: "Knowledge requests",
  description:
    "Whether knowledge requests reach the right people, get answered and get closed: from the gap the AI detects to the requester closing the request.",
  headerNote(ctx) {
    const filters = parseFilters(ctx.searchParams);
    const period = derivePeriod(ctx.today, filters.days, TRACKING_STARTED[ctx.env]);
    const who = filters.excludeInternal
      ? "requests from internal users excluded"
      : "everyone counted, including internal users";
    return `Requests sent ${formatDayRange(period.from, period.end)} ${period.end.slice(0, 4)} · ${who}`;
  },
  controls,
  sections: [overview, gaps, routingSection, answers, closingSection],
};
