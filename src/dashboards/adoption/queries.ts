// HogQL for the Adoption dashboard. Each query was checked against production
// (60292) and staging (55666) before being wired in. Values are passed as
// {placeholders}; datetimes are "YYYY-MM-DD 00:00:00" in UTC, weeks start on
// Monday. Active means a page view inside an organisation's app (appActive).
// Internal users are dropped unless the viewer includes them: `people` is then an
// AND clause built from INTERNAL_PEOPLE, otherwise "" and everyone is counted.

import { METRIC_SQL, ORG_SLUG } from "@/lib/posthog/metrics";

import { RETURN_FROM_DAY, RETURN_TO_DAY } from "./config";

const M = METRIC_SQL;

/** Lower bound for "all history" scans (both projects started in 2025). */
export const HISTORY_START = "2020-01-01 00:00:00";

/** "" when everyone is counted; otherwise a clause that drops internal users' events. */
export function peopleFilter(internalSql: string | null): string {
  return internalSql ? `\n  AND NOT (${internalSql})` : "";
}

/** Unique active people over the whole period. Values: start, end (exclusive). */
export function periodTotals(people: string): string {
  return `
SELECT
  uniq(person_id) AS active
FROM events
WHERE ${M.appActive}
  AND timestamp >= toDateTime({start})
  AND timestamp < toDateTime({end})${people}`;
}

/**
 * Per week: active people, and how many of them sent a chat message,
 * contributed or listed knowledge (a new listing or a re-list) that week. Only active
 * people count, so a share never exceeds 100%. Values: start, end (exclusive).
 */
export function weeklyPeople(people: string): string {
  return `
SELECT
  week,
  count() AS active,
  countIf(asked) AS asking,
  countIf(contributed) AS contributing,
  countIf(listed) AS listing
FROM (
  SELECT
    person_id,
    toStartOfWeek(timestamp, 1) AS week,
    countIf(${M.appActive}) > 0 AS was_active,
    countIf(${M.chatMessage}) > 0 AS asked,
    countIf(${M.contribution}) > 0 AS contributed,
    countIf((${M.newListing}) OR (${M.relist})) > 0 AS listed
  FROM events
  WHERE timestamp >= toDateTime({start})
    AND timestamp < toDateTime({end})
    AND event IN ('$pageview', 'chat_message_sent', 'knowledge_shared', 'kp_status_changed', 'knowledge_piece_republished')${people}
  GROUP BY person_id, week
)
WHERE was_active
GROUP BY week
ORDER BY week`;
}

/**
 * Per week: active organisations, knowledge requests sent and answers. The
 * old backend sent knowledge_request_completed instead of _answered, so
 * either counts. Values: start, end (exclusive).
 */
export function weeklyEvents(people: string): string {
  return `
SELECT
  toStartOfWeek(timestamp, 1) AS week,
  uniqIf(${ORG_SLUG}, ${M.appActive}) AS orgs,
  countIf(${M.requestSent}) AS requests_created,
  countIf(${M.requestAnswered} OR ${M.requestCompleted}) AS requests_answered
FROM events
WHERE timestamp >= toDateTime({start})
  AND timestamp < toDateTime({end})
  AND event IN ('$pageview', 'knowledge_request_created', 'knowledge_request_answered', 'knowledge_request_completed')${people}
GROUP BY week
ORDER BY week`;
}

/**
 * Weekly lifecycle of active people, Monday weeks:
 * new = first active week ever; returning = active this week and last week;
 * came back = active this week, not last week, not their first week;
 * dropped off = active last week, not this week.
 * Values: history_start, prev_start (week before the range), end, first_week, last_week.
 */
export function lifecycle(people: string): string {
  return `
SELECT
  week,
  countIf(status = 'new') AS new_people,
  countIf(status = 'returning') AS returning_people,
  countIf(status = 'came_back') AS came_back,
  countIf(status = 'dropped_off') AS dropped_off
FROM (
  SELECT
    -- every active week, plus the week after it (where dropping off shows up)
    arrayJoin(arrayDistinct(arrayConcat(weeks, arrayMap(w -> w + INTERVAL 1 WEEK, weeks)))) AS week,
    multiIf(
      has(weeks, week) AND week = first_week, 'new',
      has(weeks, week) AND has(weeks, week - INTERVAL 1 WEEK), 'returning',
      has(weeks, week), 'came_back',
      'dropped_off'
    ) AS status
  FROM (
    SELECT
      person_id,
      min(toStartOfWeek(timestamp, 1)) AS first_week,
      groupUniqArrayIf(toStartOfWeek(timestamp, 1), timestamp >= toDateTime({prev_start})) AS weeks
    FROM events
    WHERE ${M.appActive}
      AND timestamp >= toDateTime({history_start})
      AND timestamp < toDateTime({end})${people}
    GROUP BY person_id
  )
)
WHERE week >= toDate({first_week})
  AND week <= toDate({last_week})
GROUP BY week
ORDER BY week`;
}

/**
 * People whose first active day ever falls in the period, by the week of that
 * day, and how many came back after their first two weeks: active again on
 * day 15 to 28, with the first day as day 1. Whether a week's 28 days are up
 * is decided outside the query. Values: history_start, start, end (exclusive).
 */
export function newPeople(people: string): string {
  return `
SELECT
  toStartOfWeek(first_day, 1) AS week,
  count() AS new_people,
  countIf(arrayExists(
    d -> d >= first_day + INTERVAL ${RETURN_FROM_DAY} DAY AND d <= first_day + INTERVAL ${RETURN_TO_DAY} DAY,
    days
  )) AS returned
FROM (
  SELECT
    person_id,
    min(toDate(timestamp)) AS first_day,
    groupUniqArray(toDate(timestamp)) AS days
  FROM events
  WHERE ${M.appActive}
    AND timestamp >= toDateTime({history_start})
    AND timestamp < toDateTime({end})${people}
  GROUP BY person_id
)
WHERE first_day >= toDate({start})
GROUP BY week
ORDER BY week`;
}

/**
 * One row per organisation active in the period: its first active day ever,
 * active people in the period and in the latest complete week, and in how
 * many weeks it was active. The slug is the organisation's name; it only
 * leaves the server when the viewer turns on "Show names".
 * Values: history_start, start, last_full_week, this_week, end (exclusive).
 */
export function organisations(people: string): string {
  return `
SELECT
  org,
  first_active,
  people,
  people_last_week,
  weeks
FROM (
  SELECT
    ${ORG_SLUG} AS org,
    min(timestamp) AS first_active,
    uniqIf(person_id, timestamp >= toDateTime({start})) AS people,
    uniqIf(person_id, timestamp >= toDateTime({last_full_week}) AND timestamp < toDateTime({this_week})) AS people_last_week,
    uniqIf(toStartOfWeek(timestamp, 1), timestamp >= toDateTime({start})) AS weeks
  FROM events
  WHERE ${M.appActive}
    AND timestamp >= toDateTime({history_start})
    AND timestamp < toDateTime({end})${people}
  GROUP BY org
)
WHERE people > 0
ORDER BY people_last_week DESC, people DESC, org`;
}
