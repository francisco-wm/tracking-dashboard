import { adoptionV2 } from "./adoption-v2";
import { fragmentEditing } from "./fragment-editing";
import { homeWidgets } from "./home-widgets";
import { knowledgeChampions } from "./knowledge-champions";
import { knowledgeRequests } from "./knowledge-requests";
import type { DashboardModule } from "./types";

/**
 * Every dashboard the app serves. Adding one = a new module folder + one line here.
 * Hidden for now: Adoption v1 (`./adoption`, still in the repo and used by v2). To bring it back,
 * `import { adoption } from "./adoption"` and add it to the list.
 */
export const DASHBOARDS: readonly DashboardModule[] = [
  adoptionV2,
  knowledgeChampions,
  fragmentEditing,
  homeWidgets,
  knowledgeRequests,
];

export function getDashboard(slug: string): DashboardModule | undefined {
  return DASHBOARDS.find((d) => d.slug === slug);
}
