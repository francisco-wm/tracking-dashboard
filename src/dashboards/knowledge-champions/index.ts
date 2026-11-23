import type { DashboardModule } from "@/dashboards/types";
import { formatDayMonth, formatDayRange } from "@/lib/dates";

import { DASHBOARD_SLUG, SEND_DATES } from "./config";
import { controls } from "./controls";
import { parseFilters } from "./filters";
import { clickers } from "./sections/clickers";
import { comingBack } from "./sections/coming-back";
import { contributingSection } from "./sections/contributing";
import { questions } from "./sections/questions";
import { reach } from "./sections/reach";
import { deriveWindows, latestSend } from "./windows";

export const knowledgeChampions: DashboardModule = {
  slug: DASHBOARD_SLUG,
  title: "Knowledge Champions email",
  description:
    "Does the quarterly email celebrating the top knowledge sharers change behaviour? Chat messages, contributions and people coming back, before vs after each send.",
  headerNote(ctx) {
    const send = latestSend(SEND_DATES, ctx.today);
    if (!send) return null;
    const w = deriveWindows(send, ctx.today);
    const who = parseFilters(ctx.searchParams).excludeInternal
      ? "internal users excluded"
      : "everyone counted, including internal users";
    return `Latest send ${formatDayMonth(send)} ${send.slice(0, 4)} · comparing ${formatDayRange(w.after.start, w.after.end)} with ${formatDayRange(w.before.start, w.before.end)} · ${who}`;
  },
  controls,
  sections: [reach, questions, contributingSection, comingBack, clickers],
};
