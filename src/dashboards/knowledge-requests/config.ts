import type { ISODate } from "@/lib/dates";
import type { EnvKey } from "@/lib/posthog/environments";
import { METRIC_SQL, REQUEST_ID } from "@/lib/posthog/metrics";

import type { StartedAt } from "./filters";

export const DASHBOARD_SLUG = "knowledge-requests";

/**
 * The new knowledge-request tracking (answers, closes, rejections, gap links,
 * people or teams) started at these moments, in UTC. Nothing before them
 * counts: every number counts from the later of the range's first day and this
 * moment, so all of them count the same requests. Production's release went
 * live at 18:00 on 28 Oct; that morning's events are still the old tracking.
 */
export const TRACKING_STARTED: Record<EnvKey, StartedAt> = {
  production: { date: "2026-10-28", hour: 18 },
  staging: { date: "2026-10-26", hour: 0 },
};

/** knowledge_request_ignored fires this many days after sending when nobody has opened the request. */
export const IGNORE_DAYS = 7;

/** An answered request still open after this many days is flagged as waiting to be closed. */
export const STALE_DAYS = 14;

/**
 * The tracking-status check looks for each event's first appearance from this
 * day on. The first knowledge-request events in either project are from
 * mid-November 2025, so nothing earlier is missed.
 */
export const TRACKING_LOOKBACK: ISODate = "2025-11-01";

/**
 * Each piece of data a card needs, and the HogQL condition that shows it
 * exists. Several events and properties ship at different times per project,
 * so each card counts only requests sent since its data first appeared, and
 * waits, naming what it needs, until then.
 */
export type DataKey =
  | "sent"
  | "assignedTo"
  | "gapLink"
  | "opened"
  | "ignored"
  | "rejected"
  | "answered"
  | "closed"
  | "suggestions";

export interface TrackedData {
  /** HogQL condition on an event row. A server constant. */
  sql: string;
  event: string;
  /** Set when the event exists before the property does. */
  property?: string;
  /** Names it in "… aren't tracked in this project yet". Plural, so the verb agrees. */
  noun: string;
  /** Completes "Since … on 26 Oct". */
  since: string;
}

export const TRACKED: Record<DataKey, TrackedData> = {
  sent: {
    sql: `${METRIC_SQL.requestSent} AND isNotNull(${REQUEST_ID})`,
    event: "knowledge_request_created",
    property: "knowledge_request_uuid",
    noun: "request ids",
    since: "request ids were first tracked",
  },
  assignedTo: {
    sql: `${METRIC_SQL.requestSent} AND isNotNull(properties.assigned_to)`,
    event: "knowledge_request_created",
    property: "assigned_to",
    noun: "people-or-teams routing details",
    since: "people-or-teams routing was first tracked",
  },
  gapLink: {
    sql: `${METRIC_SQL.gapDetected} AND isNotNull(${REQUEST_ID})`,
    event: "knowledge_gap_detected",
    property: "knowledge_request_uuid",
    noun: "links from gaps to requests",
    since: "gaps were first linked to requests",
  },
  opened: {
    sql: METRIC_SQL.requestOpened,
    event: "knowledge_request_opened",
    noun: "opens",
    since: "opens were first tracked",
  },
  ignored: {
    sql: METRIC_SQL.requestIgnored,
    event: "knowledge_request_ignored",
    noun: "7-day checks",
    since: "the 7-day check was first tracked",
  },
  rejected: {
    sql: METRIC_SQL.requestRejected,
    event: "knowledge_request_rejected",
    noun: "rejections",
    since: "rejections were first tracked",
  },
  answered: {
    sql: METRIC_SQL.requestAnswered,
    event: "knowledge_request_answered",
    noun: "answers",
    since: "answers were first tracked",
  },
  closed: {
    sql: METRIC_SQL.requestClosed,
    event: "knowledge_request_closed",
    noun: "closings",
    since: "closing was first tracked",
  },
  suggestions: {
    sql: METRIC_SQL.suggestionCreated,
    event: "system_contribution_created",
    noun: "AI suggestions",
    since: "AI suggestions were first tracked",
  },
};

export const DATA_KEYS = Object.keys(TRACKED) as DataKey[];

/** `properties.reason` on knowledge_request_rejected. The reason is optional. */
export const REJECT_REASONS: Record<string, string> = {
  needs_more_info: "Needs more information",
  dont_know: "Doesn’t know the answer",
  duplicate: "Duplicate request",
  answered_elsewhere: "Answered elsewhere",
  no_longer_relevant: "No longer relevant",
  other: "Other",
  "": "No reason given",
};

/** `properties.assigned_to` on knowledge_request_created. */
export const ASSIGNED_TO: Record<string, string> = {
  users: "People only",
  both: "People and teams",
  teams: "Teams only",
};

/** `properties.answerer_role` on knowledge_request_answered; omitted when the answerer is none of these. */
export const ANSWERER_ROLES: Record<string, string> = {
  direct_assignee: "Direct assignee",
  team_member: "Team member",
  requester: "Requester",
  "": "Role unknown",
};

/** A known value's label, or the raw value for one this dashboard doesn't know yet. */
export function labelFor(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value;
}

/**
 * Who counts as internal when the viewer turns off "Include internal users".
 * `sql` is a HogQL condition on an event row: a server constant, never built
 * from the request. Same definition as Fragment editing and Home widgets;
 * production mirrors PostHog's own test-account filter.
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

/**
 * Colour roles for the stacked bars. chart-1..3 pass all-pairs; pine-400 (the
 * deliberate neutral, "before" elsewhere) is never placed next to chart-2,
 * the one pair below the normal-vision floor. "pending" is the empty track:
 * requests that can't be judged yet.
 */
export const COLORS = {
  good: "var(--color-chart-1)",
  late: "var(--color-chart-2)",
  attention: "var(--color-chart-3)",
  neutral: "var(--color-chart-before)",
  pending: "var(--color-chart-grid)",
} as const;
