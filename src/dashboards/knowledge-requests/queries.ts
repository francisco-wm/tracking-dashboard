// HogQL for the Knowledge requests dashboard. Each query was checked against
// production (60292) and staging (55666) before being wired in. Values are
// passed as {placeholders}; datetimes are "YYYY-MM-DD 00:00:00" in UTC.
// Everything is joined per request on its id, never per person: the requester,
// assignees and answerers are different people. Internal users are dropped
// unless the viewer includes them, and only on the event that puts a request or gap in the
// count (`people`, an AND clause built from INTERNAL_PEOPLE, otherwise ""):
// what happens to it afterwards belongs to that request.
//
// A LEFT JOIN without a match fills the right side with defaults (1970 dates,
// zeros), not NULLs, so every joined side is collected into arrays: no match
// is an empty array.

import { METRIC_SQL, REQUEST_ID, SUGGESTION_REQUEST_ID } from "@/lib/posthog/metrics";

import { DATA_KEYS, TRACKED } from "./config";

const M = METRIC_SQL;

/** "" when everyone is counted; otherwise a clause that drops internal users' events. */
export function peopleFilter(internalSql: string | null): string {
  return internalSql ? `\n  AND NOT (${internalSql})` : "";
}

const IN_PERIOD = `timestamp >= toDateTime({start})
    AND timestamp < toDateTime({end})`;

const LIFECYCLE_EVENTS = [
  "knowledge_gap_detected",
  "knowledge_request_created",
  "knowledge_request_opened",
  "knowledge_request_ignored",
  "knowledge_request_rejected",
  "knowledge_request_answered",
  "knowledge_request_closed",
  "system_contribution_created",
];

/**
 * When each piece of data a card needs (TRACKED) first appeared in the
 * project, and how often. Everyone's events count here: this is about the
 * tracking, not the people. Values: since, end (exclusive).
 */
export function trackingStatus(): string {
  const columns = DATA_KEYS.map(
    (key) => `  toString(toDate(minIf(timestamp, ${TRACKED[key].sql}))) AS ${key}_since,
  countIf(${TRACKED[key].sql}) AS ${key}_events`,
  ).join(",\n");
  return `
SELECT
${columns}
FROM events
WHERE timestamp >= toDateTime({since})
  AND timestamp < toDateTime({end})
  AND event IN (${LIFECYCLE_EVENTS.map((e) => `'${e}'`).join(", ")})`;
}

/** Events of one kind per request id, as an array of `item` per request. */
function perRequest(condition: string, item: string, name: string): string {
  return `
  SELECT toString(${REQUEST_ID}) AS request, groupArray(${item}) AS ${name}
  FROM events
  WHERE ${IN_PERIOD}
    AND ${condition}
    AND isNotNull(${REQUEST_ID})
  GROUP BY request`;
}

const AT = `toUnixTimestamp(timestamp)`;

/**
 * One row per request sent in the period, with everything that happened to it
 * since, up to now. Times are Unix seconds. Values: start, end (exclusive).
 */
export function requests(people: string): string {
  return `
SELECT
  c.request AS request,
  toUnixTimestamp(c.sent_at) AS sent_at,
  c.assigned_to AS assigned_to,
  o.opened AS opened,
  i.ignored AS ignored,
  a.answers AS answers,
  r.rejections AS rejections,
  x.closes AS closes,
  s.made AS suggested,
  s.accepted AS accepted,
  s.declined AS declined,
  toUnixTimestamp(now()) AS now
FROM (
  SELECT
    toString(${REQUEST_ID}) AS request,
    min(timestamp) AS sent_at,
    ifNull(any(toString(properties.assigned_to)), '') AS assigned_to
  FROM events
  WHERE ${IN_PERIOD}
    AND ${M.requestSent}
    AND isNotNull(${REQUEST_ID})${people}
  GROUP BY request
) AS c
LEFT JOIN (${perRequest(M.requestOpened, `(${AT}, toFloat(properties.time_since_assigned_seconds))`, "opened")}
) AS o ON c.request = o.request
LEFT JOIN (${perRequest(M.requestIgnored, AT, "ignored")}
) AS i ON c.request = i.request
LEFT JOIN (${perRequest(
    M.requestAnswered,
    `(${AT}, toFloat(properties.seconds_open), ifNull(toString(properties.answerer_role), ''))`,
    "answers",
  )}
) AS a ON c.request = a.request
LEFT JOIN (${perRequest(
    M.requestRejected,
    `(${AT}, ifNull(toString(properties.reason), ''), ifNull(toString(properties.reassigned), '') = 'true')`,
    "rejections",
  )}
) AS r ON c.request = r.request
LEFT JOIN (${perRequest(
    M.requestClosed,
    `(${AT}, ifNull(toString(properties.outcome), ''), toFloat(properties.seconds_open))`,
    "closes",
  )}
) AS x ON c.request = x.request
LEFT JOIN (
  SELECT
    toString(${SUGGESTION_REQUEST_ID}) AS request,
    groupUniqArrayIf(toString(properties.knowledge_fragment_id), ${M.suggestionCreated}) AS made,
    groupUniqArrayIf(toString(properties.knowledge_fragment_id), ${M.suggestionApproved}) AS accepted,
    groupUniqArrayIf(toString(properties.knowledge_fragment_id), ${M.suggestionRejected}) AS declined
  FROM events
  WHERE ${IN_PERIOD}
    AND event IN ('system_contribution_created', 'system_contribution_approved', 'system_contribution_rejected')
    AND isNotNull(${SUGGESTION_REQUEST_ID})
  GROUP BY request
) AS s ON c.request = s.request
ORDER BY sent_at
LIMIT 10000`;
}

/**
 * Gaps the AI detected, per day: every gap (`detected`), those carrying their
 * request's id (`linked`), and of those, the ones whose request was sent since
 * (`sent`). A gap without the id can't be matched. Values: start, end (exclusive).
 */
export function gapsDaily(people: string): string {
  return `
SELECT
  toDate(g.detected_at) AS day,
  count() AS detected,
  countIf(g.request != '') AS linked,
  countIf(g.request != '' AND length(c.sent) > 0) AS sent
FROM (
  SELECT timestamp AS detected_at, ifNull(toString(${REQUEST_ID}), '') AS request
  FROM events
  WHERE ${IN_PERIOD}
    AND ${M.gapDetected}${people}
) AS g
LEFT JOIN (
  SELECT toString(${REQUEST_ID}) AS request, groupArray(timestamp) AS sent
  FROM events
  WHERE ${IN_PERIOD}
    AND ${M.requestSent}
    AND isNotNull(${REQUEST_ID})
  GROUP BY request
) AS c ON g.request = c.request
GROUP BY day
ORDER BY day`;
}
