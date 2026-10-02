import type { ISODate } from "@/lib/dates";
import type { EnvKey } from "@/lib/posthog/environments";

export const DASHBOARD_SLUG = "home-widgets";

export interface Widget {
  id: string;
  label: string;
  /** A chart colour token; the widget keeps it on every chart. */
  color: string;
}

/** The widgets on the organisation home page, in the order they are drawn. */
export const WIDGETS: readonly Widget[] = [
  { id: "recent-fragment-drafts", label: "Recent fragment drafts", color: "var(--color-chart-1)" },
  { id: "assigned-knowledge-requests", label: "Assigned knowledge requests", color: "var(--color-chart-2)" },
  { id: "recent-private-files", label: "Recent private files", color: "var(--color-chart-3)" },
];

export const DRAFTS_WIDGET = "recent-fragment-drafts";
export const REQUESTS_WIDGET = "assigned-knowledge-requests";

/** `properties.action` on dashboard_widget_clicked. */
export const ACTIONS: Record<string, string> = {
  open_item: "Opened an item",
  create_fragment_draft: "Started a new draft",
};

/** A widget's label, or its raw id for one this dashboard doesn't know yet. */
export function widgetLabel(id: string): string {
  return WIDGETS.find((w) => w.id === id)?.label ?? id;
}

export function actionLabel(action: string): string {
  return ACTIONS[action] ?? action;
}

/** First widget click in each project. Marked on every timeline. */
export const WIDGETS_LIVE: Record<EnvKey, ISODate> = {
  production: "2026-09-23",
  staging: "2026-09-14",
};

/** Follow-through counts what happened within this many days of the click. */
export const FOLLOW_WINDOW_DAYS = 7;

/**
 * A click and what it opened or created are separate events: the draft created,
 * or the page viewed, by the same person within this many seconds. In both
 * projects every match so far came within 1 second.
 */
export const LINK_SECONDS = 30;

/** A retry worked when the same widget didn't fail again for that person within this many seconds. */
export const RETRY_SECONDS = 60;

/**
 * Who counts as internal when the viewer turns off "Include internal users".
 * `sql` is a HogQL condition on an event row: a server constant, never built
 * from the request. Same definition as Fragment editing; production mirrors
 * PostHog's own test-account filter.
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
