import { adoption } from "./adoption";
import { adoptionV2 } from "./adoption-v2";
import { fragmentEditing } from "./fragment-editing";
import { homeWidgets } from "./home-widgets";
import { knowledgeChampions } from "./knowledge-champions";
import { knowledgeRequests } from "./knowledge-requests";
import type { DashboardModule } from "./types";

/** Every dashboard the app serves. Adding one = a new module folder + one line here. */
export const DASHBOARDS: readonly DashboardModule[] = [
  adoption,
  adoptionV2,
  knowledgeChampions,
  fragmentEditing,
  homeWidgets,
  knowledgeRequests,
];

export function getDashboard(slug: string): DashboardModule | undefined {
  return DASHBOARDS.find((d) => d.slug === slug);
}
