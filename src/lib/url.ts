export type QueryInput = Record<string, string | string[] | undefined>;

/**
 * `path` plus the current query string with `overrides` applied. An override
 * of null removes the key. Keys keep a stable order so links stay comparable.
 */
export function hrefWith(
  path: string,
  current: QueryInput,
  overrides: Record<string, string | null> = {},
): string {
  const params = new URLSearchParams();
  const merged: Record<string, string | null | undefined> = {};
  for (const [key, value] of Object.entries(current)) {
    merged[key] = Array.isArray(value) ? value[0] : value;
  }
  Object.assign(merged, overrides);
  for (const key of Object.keys(merged).sort()) {
    const value = merged[key];
    if (value !== null && value !== undefined && value !== "") params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function searchParamsToObject(params: URLSearchParams): QueryInput {
  return Object.fromEntries(params.entries());
}
