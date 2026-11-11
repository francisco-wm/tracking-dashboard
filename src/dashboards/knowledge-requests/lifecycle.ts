// Pure summaries of the per-request rows. A request is the unit everywhere:
// everything that happened to it is joined on its id, whoever did it.
// Times are Unix seconds; durations are medians, never averages.

import { formatISODate, type ISODate } from "@/lib/dates";

import { ANSWERER_ROLES, ASSIGNED_TO, IGNORE_DAYS, REJECT_REASONS, STALE_DAYS } from "./config";

const DAY = 86_400;

export interface Answer {
  at: number;
  /** Seconds since the request was sent, as tracked. */
  secondsOpen: number | null;
  role: string;
}

export interface Rejection {
  at: number;
  reason: string;
  /** The rejecter suggested someone else. */
  reassigned: boolean;
}

export interface Close {
  at: number;
  outcome: string;
  secondsOpen: number | null;
}

export interface RequestRow {
  request: string;
  /** The first assignment, which is when a request is sent. */
  sentAt: number;
  sentDay: ISODate;
  /** users, teams, both, or "" when not tracked. */
  assignedTo: string;
  /**
   * The first time any assignee opened it, named or through a team. That can
   * be the requester, when they assigned themselves or are in an assigned team.
   */
  opened: { at: number; sinceAssigned: number | null } | null;
  ignored: boolean;
  /** Oldest first. */
  answers: Answer[];
  /** Oldest first. */
  rejections: Rejection[];
  /** The latest close, if any. */
  close: Close | null;
  /** Knowledge fragment ids of AI-suggested answers. */
  suggestions: { made: string[]; accepted: string[]; declined: string[] };
}

export function dayOf(unixSeconds: number): ISODate {
  return formatISODate(new Date(unixSeconds * 1000));
}

/** The middle value; for an even count, the mean of the two middle values. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const resolved = (r: RequestRow) => r.close?.outcome === "resolved";

// --- Overview -------------------------------------------------------------------

export interface FunnelCounts {
  sent: number;
  opened: number;
  /** Opened, then answered. */
  answered: number;
  /** Opened, answered, then resolved. */
  resolved: number;
  /** Answered although no assignee opened it (e.g. the requester answered). */
  answeredUnopened: number;
  /** Resolved without a published answer (e.g. an accepted AI suggestion). */
  resolvedUnanswered: number;
}

/**
 * Each step counts the requests that also reached every step before it, so a
 * step never exceeds the one above. The requests that skipped a step are
 * counted on their own. While answers aren't tracked, "resolved" follows
 * straight from "opened".
 */
export function funnelCounts(rows: RequestRow[], answersTracked = true): FunnelCounts {
  const opened = rows.filter((r) => r.opened);
  const answered = opened.filter((r) => r.answers.length > 0);
  return {
    sent: rows.length,
    opened: opened.length,
    answered: answered.length,
    resolved: (answersTracked ? answered : opened).filter(resolved).length,
    answeredUnopened: rows.filter((r) => !r.opened && r.answers.length > 0).length,
    resolvedUnanswered: rows.filter((r) => resolved(r) && r.answers.length === 0).length,
  };
}

// --- Routing --------------------------------------------------------------------

export const SEEN_BUCKETS = [
  "openedInTime",
  "openedLate",
  "notOpened",
  "closedUnopened",
  "tooRecent",
] as const;
export type SeenBucket = (typeof SEEN_BUCKETS)[number];

/**
 * Opened within the 7 days; opened only after them; still unopened after them
 * (knowledge_request_ignored fired); unopened but no 7-day check fired, which
 * happens when it was closed or deleted first; or sent too recently to tell.
 */
export function seenBucket(row: RequestRow, now: number): SeenBucket {
  if (row.opened) return row.opened.at - row.sentAt > IGNORE_DAYS * DAY ? "openedLate" : "openedInTime";
  if (now - row.sentAt < IGNORE_DAYS * DAY) return "tooRecent";
  return row.ignored ? "notOpened" : "closedUnopened";
}

export interface SeenSummary {
  counts: Record<SeenBucket, number>;
  opened: number;
  /** Median seconds from sending to the first open, over opened requests. */
  medianToOpen: number | null;
  /** Sent at least 7 days ago, so the 7-day check has run. */
  oldEnough: number;
  /** Still unopened after 7 days (knowledge_request_ignored), whether or not opened later. */
  ignored: number;
}

export function seenSummary(rows: RequestRow[], now: number): SeenSummary {
  const counts = Object.fromEntries(SEEN_BUCKETS.map((b) => [b, 0])) as Record<SeenBucket, number>;
  for (const row of rows) counts[seenBucket(row, now)] += 1;
  const toOpen = rows.flatMap((r) => (r.opened ? [r.opened.sinceAssigned ?? r.opened.at - r.sentAt] : []));
  return {
    counts,
    opened: counts.openedInTime + counts.openedLate,
    medianToOpen: median(toOpen),
    oldEnough: rows.filter((r) => now - r.sentAt >= IGNORE_DAYS * DAY).length,
    ignored: rows.filter((r) => r.ignored).length,
  };
}

export interface Counted {
  key: string;
  label: string;
  count: number;
}

/** Counts by key: known keys in their configured order, then unknown ones, biggest first. */
function countBy(keys: string[], labels: Record<string, string>, keepZeros: boolean): Counted[] {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  const known = Object.keys(labels);
  const rank = (key: string) => (known.includes(key) ? known.indexOf(key) : known.length);
  const all = keepZeros ? new Set([...known, ...counts.keys()]) : new Set(counts.keys());
  return [...all]
    .map((key) => ({ key, label: labels[key] ?? key, count: counts.get(key) ?? 0 }))
    .sort((a, b) => b.count - a.count || rank(a.key) - rank(b.key));
}

export interface RejectionSummary {
  total: number;
  /** Every reason, most common first; zeros included so they read as "none". */
  byReason: Counted[];
  /** Rejections where the rejecter suggested someone else. */
  passedOn: number;
  /** Of those, how many were followed by an answer to the request. */
  passedOnAnswered: number;
  /** Requests rejected at least once. */
  requests: number;
}

export function rejectionSummary(rows: RequestRow[]): RejectionSummary {
  const all = rows.flatMap((r) => r.rejections.map((rejection) => ({ row: r, rejection })));
  const passedOn = all.filter((x) => x.rejection.reassigned);
  return {
    total: all.length,
    byReason: countBy(
      all.map((x) => x.rejection.reason),
      REJECT_REASONS,
      true,
    ),
    passedOn: passedOn.length,
    passedOnAnswered: passedOn.filter((x) => x.row.answers.some((a) => a.at > x.rejection.at)).length,
    requests: rows.filter((r) => r.rejections.length > 0).length,
  };
}

export interface AssignmentGroup {
  assignedTo: string;
  label: string;
  requests: number;
  answered: number;
}

/** Requests and how many got an answer, per way of assigning: people, teams or both. Requests without the property are left out. */
export function requestsByAssignment(rows: RequestRow[]): AssignmentGroup[] {
  const known = Object.keys(ASSIGNED_TO);
  const values = [...new Set([...known, ...rows.map((r) => r.assignedTo).filter(Boolean)])];
  return values.map((assignedTo) => {
    const group = rows.filter((r) => r.assignedTo === assignedTo);
    return {
      assignedTo,
      label: ASSIGNED_TO[assignedTo] ?? assignedTo,
      requests: group.length,
      answered: group.filter((r) => r.answers.length > 0).length,
    };
  });
}

// --- Answers --------------------------------------------------------------------

export interface AnswerSummary {
  requests: number;
  answered: number;
  answers: number;
  /** Median seconds from sending to the first answer, over answered requests. */
  medianToFirst: number | null;
  /** Answered requests by how many answers they got. */
  perRequest: { one: number; two: number; threeOrMore: number };
  /** Every answer by who wrote it. */
  byRole: Counted[];
}

export function answerSummary(rows: RequestRow[]): AnswerSummary {
  const answered = rows.filter((r) => r.answers.length > 0);
  const firsts = answered.map((r) => {
    const first = r.answers[0];
    return first.secondsOpen ?? first.at - r.sentAt;
  });
  const roles = rows.flatMap((r) => r.answers.map((a) => a.role));
  return {
    requests: rows.length,
    answered: answered.length,
    answers: roles.length,
    medianToFirst: median(firsts),
    perRequest: {
      one: answered.filter((r) => r.answers.length === 1).length,
      two: answered.filter((r) => r.answers.length === 2).length,
      threeOrMore: answered.filter((r) => r.answers.length >= 3).length,
    },
    byRole: countBy(roles, ANSWERER_ROLES, false),
  };
}

export interface SuggestionSummary {
  requests: number;
  /** Requests with at least one AI suggestion. */
  withSuggestions: number;
  made: number;
  accepted: number;
  declined: number;
  notReviewed: number;
}

/** One suggestion per request and fragment; accepting wins if it was also declined at some point. */
export function suggestionSummary(rows: RequestRow[]): SuggestionSummary {
  let made = 0;
  let accepted = 0;
  let declined = 0;
  let withSuggestions = 0;
  for (const { suggestions: s } of rows) {
    const all = new Set([...s.made, ...s.accepted, ...s.declined]);
    const yes = new Set(s.accepted);
    const no = new Set(s.declined.filter((id) => !yes.has(id)));
    made += all.size;
    accepted += yes.size;
    declined += no.size;
    if (all.size > 0) withSuggestions += 1;
  }
  return {
    requests: rows.length,
    withSuggestions,
    made,
    accepted,
    declined,
    notReviewed: made - accepted - declined,
  };
}

// --- Closing --------------------------------------------------------------------

export const CLOSE_BUCKETS = ["resolved", "cancelled", "openAnswered", "openUnanswered"] as const;
export type CloseBucket = (typeof CLOSE_BUCKETS)[number];

export interface ClosingSummary {
  counts: Record<CloseBucket, number>;
  /** Median seconds from sending to resolving, over resolved requests. */
  medianToResolve: number | null;
  /** Answered, still open, and sent more than STALE_DAYS ago. */
  staleAnswered: number;
}

/** Any outcome other than "resolved" counts as cancelled; the backend sends only those two. */
export function closingSummary(rows: RequestRow[], now: number): ClosingSummary {
  const counts = Object.fromEntries(CLOSE_BUCKETS.map((b) => [b, 0])) as Record<CloseBucket, number>;
  for (const row of rows) {
    if (row.close) counts[resolved(row) ? "resolved" : "cancelled"] += 1;
    else counts[row.answers.length > 0 ? "openAnswered" : "openUnanswered"] += 1;
  }
  const toResolve = rows.flatMap((r) =>
    resolved(r) && r.close ? [r.close.secondsOpen ?? r.close.at - r.sentAt] : [],
  );
  return {
    counts,
    medianToResolve: median(toResolve),
    staleAnswered: rows.filter((r) => !r.close && r.answers.length > 0 && now - r.sentAt > STALE_DAYS * DAY)
      .length,
  };
}

// --- Query rows -----------------------------------------------------------------

const num = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0) || 0);
const numOrNull = (value: unknown) =>
  value === null || value === undefined || value === "" || Number.isNaN(Number(value)) ? null : Number(value);
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const tuple = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const truthy = (value: unknown) => value === true || value === 1 || value === "1" || value === "true";

/** One query row → a request with its events in time order. */
export function parseRequest(r: Record<string, unknown>): RequestRow {
  const sentAt = num(r.sent_at);
  const opened = list(r.opened)
    .map(tuple)
    .map(([at, since]) => ({ at: num(at), sinceAssigned: numOrNull(since) }))
    .sort((a, b) => a.at - b.at)[0];
  const answers: Answer[] = list(r.answers)
    .map(tuple)
    .map(([at, secondsOpen, role]) => ({ at: num(at), secondsOpen: numOrNull(secondsOpen), role: str(role) }))
    .sort((a, b) => a.at - b.at);
  const rejections: Rejection[] = list(r.rejections)
    .map(tuple)
    .map(([at, reason, reassigned]) => ({ at: num(at), reason: str(reason), reassigned: truthy(reassigned) }))
    .sort((a, b) => a.at - b.at);
  const closes: Close[] = list(r.closes)
    .map(tuple)
    .map(([at, outcome, secondsOpen]) => ({
      at: num(at),
      outcome: str(outcome),
      secondsOpen: numOrNull(secondsOpen),
    }))
    .sort((a, b) => a.at - b.at);
  return {
    request: str(r.request),
    sentAt,
    sentDay: dayOf(sentAt),
    assignedTo: str(r.assigned_to),
    opened: opened ?? null,
    ignored: list(r.ignored).length > 0,
    answers,
    rejections,
    close: closes.at(-1) ?? null,
    suggestions: {
      made: list(r.suggested).map(str),
      accepted: list(r.accepted).map(str),
      declined: list(r.declined).map(str),
    },
  };
}

// --- Formatting -----------------------------------------------------------------

const one = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

/** "8 s", "42 min", "1.5 h", "23 h", "4.2 days", "12 days" */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = seconds / 3600;
  if (hours < 48) return `${hours < 10 ? one.format(hours) : Math.round(hours)} h`;
  const days = seconds / DAY;
  return `${days < 10 ? one.format(days) : Math.round(days)} days`;
}
