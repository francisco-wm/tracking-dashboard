import type { ReactNode } from "react";

import type { ISODate } from "@/lib/dates";
import type { AllowedProjectId, EnvKey } from "@/lib/posthog/environments";

export type SearchParams = Record<string, string | string[] | undefined>;

/** Everything a section needs to load its data. Built on the server per request. */
export interface DashboardContext {
  dashboard: string;
  env: EnvKey;
  projectId: AllowedProjectId;
  today: ISODate;
  searchParams: SearchParams;
}

export interface SectionLoadResult<Data> {
  data: Data;
  /** Oldest fetch time among the section's queries (ISO timestamp). */
  asOf: string;
}

export interface SectionModule<Data = unknown> {
  slug: string;
  label: string;
  load(ctx: DashboardContext): Promise<SectionLoadResult<Data>>;
  View(props: { data: Data; ctx: DashboardContext }): ReactNode;
}

export interface DashboardModule {
  slug: string;
  title: string;
  description: string;
  /** One line under the title, e.g. which windows are being compared. */
  headerNote?(ctx: DashboardContext): string | null;
  /**
   * Dashboard-wide filters shown next to the environment switch, e.g. a date
   * range. `path` is the current section's path, for building links.
   */
  controls?(ctx: DashboardContext, path: string): ReactNode;
  // Each section owns its data type; the page only passes load() output to View.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sections: readonly SectionModule<any>[];
}

/** Oldest of several fetchedAt timestamps. */
export function oldest(...timestamps: string[]): string {
  return timestamps.reduce((a, b) => (a < b ? a : b));
}
