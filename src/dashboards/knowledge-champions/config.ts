import type { ISODate } from "@/lib/dates";
import type { EnvKey } from "@/lib/posthog/environments";

export const DASHBOARD_SLUG = "knowledge-champions";

/**
 * Every send of the quarterly email, planned ones too. The latest one on or
 * before today drives the page; later ones are ignored until their day.
 */
export const SEND_DATES: readonly ISODate[] = ["2026-10-01", "2027-01-01"];

/**
 * Who counts as internal while "Include internal users" is off (the default).
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
