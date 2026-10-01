import "server-only";

import { assertAllowedProjectId, type AllowedProjectId } from "./environments";

const POSTHOG_HOST = "https://eu.posthog.com";

export type HogQLValue = string | number | boolean;
export type HogQLRow = unknown[];

export interface HogQLResult {
  columns: string[];
  rows: HogQLRow[];
}

export class PostHogQueryError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PostHogQueryError";
  }
}

/**
 * Runs a HogQL query against one of the allowed projects. Test-account
 * filtering is never applied: everyone is counted. `refresh: force_blocking`
 * makes PostHog recompute instead of serving its own cache, because our cache
 * (cached-query.ts) is the only layer that should decide freshness.
 */
export async function runHogQL(
  projectId: AllowedProjectId,
  name: string,
  query: string,
  values: Record<string, HogQLValue> = {},
): Promise<HogQLResult> {
  assertAllowedProjectId(projectId);

  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!apiKey) {
    throw new PostHogQueryError("POSTHOG_PERSONAL_API_KEY is not set. Add it to .env.local.");
  }

  const response = await fetch(`${POSTHOG_HOST}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `analytics:${name}`,
      refresh: "force_blocking",
      query: { kind: "HogQLQuery", query, values },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new PostHogQueryError(
      `PostHog query "${name}" failed (${response.status}): ${await readError(response)}`,
      response.status,
    );
  }

  const body = (await response.json()) as {
    columns?: string[];
    results?: HogQLRow[];
    error?: string;
  };
  if (body.error) {
    throw new PostHogQueryError(`PostHog query "${name}" failed: ${body.error}`);
  }
  return { columns: body.columns ?? [], rows: body.results ?? [] };
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
