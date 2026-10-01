"use server";

import { updateTag } from "next/cache";

import { getDashboard } from "@/dashboards/registry";
import { requireUser } from "@/lib/auth/session";
import { dashboardCacheTag } from "@/lib/posthog/cached-query";
import { ENVIRONMENTS, parseEnv } from "@/lib/posthog/environments";

/**
 * Drops the cached PostHog results for one dashboard in one environment, so
 * the re-render that follows fetches fresh data. Server actions are public
 * endpoints: check the session and validate every argument.
 */
export async function refreshDashboard(dashboard: string, env: string): Promise<void> {
  await requireUser();
  const envKey = parseEnv(env);
  if (!envKey || !getDashboard(dashboard)) throw new Error("Unknown dashboard or environment");
  updateTag(dashboardCacheTag(ENVIRONMENTS[envKey].projectId, dashboard));
}
