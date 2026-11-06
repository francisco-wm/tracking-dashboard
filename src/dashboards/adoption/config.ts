import type { EnvKey } from "@/lib/posthog/environments";

export const DASHBOARD_SLUG = "adoption";

/**
 * "Came back after the first two weeks": active again on day 15 to day 28,
 * counting a person's first active day as day 1. Offsets from that first day.
 */
export const RETURN_FROM_DAY = 14;
export const RETURN_TO_DAY = 27;

/**
 * Weekly active people also draw a trailing average over this many weeks. The
 * chart is weekly, so 4 weeks (28 days) is the closest whole number to 30 days.
 */
export const AVERAGE_WEEKS = 4;

/** Knowledge requests are shown per this many active people: per person, the numbers are too small to read. */
export const PER_PEOPLE = 100;

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
