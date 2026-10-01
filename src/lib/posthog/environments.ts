// The only PostHog projects this app may query. The browser only ever sends an
// environment key; the server maps it to a project ID here.
export const ENVIRONMENTS = {
  production: { label: "Production", projectId: 60292 },
  staging: { label: "Staging", projectId: 55666 },
} as const;

export type EnvKey = keyof typeof ENVIRONMENTS;
export type AllowedProjectId = (typeof ENVIRONMENTS)[EnvKey]["projectId"];

export const DEFAULT_ENV: EnvKey = "production";
export const ENV_KEYS = Object.keys(ENVIRONMENTS) as EnvKey[];

const ALLOWED_PROJECT_IDS: ReadonlySet<number> = new Set(ENV_KEYS.map((key) => ENVIRONMENTS[key].projectId));

/** Missing → default environment. Anything that isn't a known key → null. */
export function parseEnv(value: string | string[] | undefined): EnvKey | null {
  if (value === undefined) return DEFAULT_ENV;
  if (typeof value !== "string") return null;
  return (ENV_KEYS as string[]).includes(value) ? (value as EnvKey) : null;
}

export function assertAllowedProjectId(projectId: number): asserts projectId is AllowedProjectId {
  if (!ALLOWED_PROJECT_IDS.has(projectId)) {
    throw new Error(`PostHog project ${projectId} is not allowed`);
  }
}
