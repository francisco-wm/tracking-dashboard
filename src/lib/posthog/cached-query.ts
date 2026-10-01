import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { runHogQL, type HogQLValue } from "./client";
import type { AllowedProjectId } from "./environments";

export type QueryRecord = Record<string, unknown>;

export interface CachedQueryResult {
  records: QueryRecord[];
  /** ISO timestamp of the moment PostHog actually answered. */
  fetchedAt: string;
}

/** One tag per project + dashboard, so the refresh button clears exactly that. */
export function dashboardCacheTag(projectId: AllowedProjectId, dashboard: string) {
  return `ph:${projectId}:${dashboard}`;
}

/**
 * HogQL with a ~10 minute server-side cache, keyed by project, query and
 * values. Entries refresh after 9 minutes and are never served past 10.
 * If this moves to a serverless host, switch to 'use cache: remote' so
 * instances share entries.
 */
export async function cachedHogQL(
  projectId: AllowedProjectId,
  dashboard: string,
  name: string,
  query: string,
  values: Record<string, HogQLValue>,
): Promise<CachedQueryResult> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 540, expire: 600 });
  cacheTag(dashboardCacheTag(projectId, dashboard));

  const { columns, rows } = await runHogQL(projectId, name, query, values);
  const records = rows.map((row) => Object.fromEntries(columns.map((column, i) => [column, row[i]])));
  return { records, fetchedAt: new Date().toISOString() };
}
