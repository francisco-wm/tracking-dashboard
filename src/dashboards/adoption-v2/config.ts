import type { ISODate } from "@/lib/dates";
import type { EnvKey } from "@/lib/posthog/environments";

export const DASHBOARD_SLUG = "adoption-dashboard";

/**
 * Citations (knowledge_fragment_used_in_response) started at these moments,
 * UTC. Sourced answers, the uncited-answer rate and the aha moment don't exist
 * before them, so they count from here.
 */
export const CITATIONS_STARTED: Record<EnvKey, string> = {
  production: "2026-10-28 18:00:00",
  staging: "2026-10-19 12:46:00",
};

/** knowledge_request_answered, with the request id, started here; the old backend's _completed has no id. */
export const ANSWERS_STARTED: Record<EnvKey, string> = {
  production: "2026-10-28 18:00:00",
  staging: "2026-10-26 00:00:00",
};

/** First core action and aha moment count within days 1 to 14, registration day being day 1. */
export const ACTIVATION_DAYS = 14;
/** "Returned": a core action again on day 8 to 28. */
export const RETURN_FROM_DAY = 8;
export const RETURN_TO_DAY = 28;
/** The funnel follows people who registered in the 12 weeks before their 28 days could be over. */
export const FUNNEL_WEEKS = 12;
/** Invites count when sent at least this long ago, so each had its full chance. */
export const INVITE_DAYS = 14;

/** Cohort table: registration weeks shown, and weeks after registration (0 to 8). */
export const COHORT_WEEKS = 16;
export const COHORT_SPAN = 8;

/** A share whose base is below this is greyed out: too few to read. */
export const SMALL_BASE = 5;

/** Account health thresholds. */
export const HEALTH = {
  /** Red: no core action in this many days. */
  inactiveDays: 14,
  /** Red below this seat activation, amber below `amberSeats`. */
  redSeats: 0.1,
  amberSeats: 0.3,
  /** Amber when last week is this far below the org's own 4-week average. */
  amberTrend: -0.2,
};

/**
 * Vertical markers on every weekly chart, from their day on. Add holidays,
 * releases and customer events here.
 */
export const ANNOTATIONS: { date: ISODate; label: string }[] = [
  { date: "2026-10-28", label: "New knowledge requests released; citation tracking starts" },
];
