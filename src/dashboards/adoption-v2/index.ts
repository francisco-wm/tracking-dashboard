import type { DashboardModule } from "@/dashboards/types";
import { formatDayRange } from "@/lib/dates";

import { DASHBOARD_SLUG } from "./config";
import { controls } from "./controls";
import { derivePeriod, parseFilters } from "./filters";
import { accountsSection } from "./sections/accounts";
import { activationSection } from "./sections/activation";
import { headlineSection } from "./sections/headline";
import { knowledgeLoopSection } from "./sections/knowledge-loop";
import { retentionSection } from "./sections/retention";

export const adoptionV2: DashboardModule = {
  slug: DASHBOARD_SLUG,
  title: "Adoption dashboard",
  description:
    "Is wingmaite being adopted, and where does value happen? Active people and organisations, account health, activation, retention and the knowledge loop.",
  headerNote(ctx) {
    const filters = parseFilters(ctx.searchParams);
    const period = derivePeriod(ctx.today, filters.weeks);
    const who = filters.excludeInternal
      ? "internal users excluded"
      : "everyone counted, including internal users";
    return `${formatDayRange(period.start, period.end)} ${period.end.slice(0, 4)} · ${who}`;
  },
  controls,
  sections: [headlineSection, accountsSection, activationSection, retentionSection, knowledgeLoopSection],
};
