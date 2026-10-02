import type { ISODate } from "@/lib/dates";
import type { EnvKey } from "@/lib/posthog/environments";

export const DASHBOARD_SLUG = "fragment-editing";

/** Editing listed fragments opened to everyone on this day. Marked on every timeline. */
export const EDITING_PUBLIC: ISODate = "2026-09-23";

/** A started edit counts as completed when the fragment is re-listed within this many days. */
export const COMPLETION_WINDOW_DAYS = 30;

/**
 * Who counts as internal when the viewer turns off "Include internal users".
 * `sql` is a HogQL condition on an event row: a server constant, never built
 * from the request. Production mirrors PostHog's own test-account filter.
 */
export const INTERNAL_PEOPLE: Record<EnvKey, { sql: string; description: string }> = {
  production: {
    sql: "person_id IN COHORT 61287",
    description:
      "people in PostHog’s “Wingmaite internal users” cohort (a @wingmaite.com email, or recent activity in the wingmaite GmbH or DemoRoast GmbH organisations), the same filter PostHog dashboards use for test accounts",
  },
  staging: {
    sql: "ifNull(person.properties.email ILIKE '%@wingmaite.com%', 0)",
    description:
      "anyone with a @wingmaite.com email. Staging has no internal-users cohort, and almost everyone there is internal",
  },
};
