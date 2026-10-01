import { knowledgeChampions } from "./knowledge-champions";
import type { DashboardModule } from "./types";

/** Every dashboard the app serves. Adding one = a new module folder + one line here. */
export const DASHBOARDS: readonly DashboardModule[] = [knowledgeChampions];

export function getDashboard(slug: string): DashboardModule | undefined {
  return DASHBOARDS.find((d) => d.slug === slug);
}
