// HogQL for the Home widgets dashboard. Each query was checked against
// production (60292) and staging (55666) before being wired in. Values are
// passed as {placeholders}; datetimes are "YYYY-MM-DD 00:00:00" in UTC.
// Internal users are dropped unless the viewer includes them: `people` is then an
// AND clause built from INTERNAL_PEOPLE, otherwise "" and everyone is counted.

import { FRAGMENT_ID, METRIC_SQL, WIDGET_ID } from "@/lib/posthog/metrics";

import { DRAFTS_WIDGET, FOLLOW_WINDOW_DAYS, LINK_SECONDS, REQUESTS_WIDGET, RETRY_SECONDS } from "./config";

const M = METRIC_SQL;

/** "" when everyone is counted; otherwise a clause that drops internal users' events. */
export function peopleFilter(internalSql: string | null): string {
  return internalSql ? `\n  AND NOT (${internalSql})` : "";
}

const IN_PERIOD = `timestamp >= toDateTime({start})
  AND timestamp < toDateTime({end})`;

/** A new listing or a re-list: the fragment went live. */
const LISTED = `((${M.newListing}) OR (${M.relist}))`;

/** `t` happened within the follow-through window after `s`. */
const WITHIN_WINDOW = (t: string, s: string) =>
  `${t} >= ${s} AND ${t} <= ${s} + INTERVAL ${FOLLOW_WINDOW_DAYS} DAY`;

/** A fragment's own page; the fragment id is the last path segment. */
const FRAGMENT_PAGE = `/company-knowledge/fragments/([0-9a-fA-F-]{36})`;

// --- Interactions -----------------------------------------------------------------

/**
 * Home-page visitors next to widget clickers and failures, all over the
 * period. Values: start, end (exclusive).
 */
export function homeTotals(people: string): string {
  return `
SELECT
  uniqIf(person_id, ${M.homeView}) AS home_people,
  countIf(${M.homeView}) AS home_views,
  uniqIf(person_id, ${M.widgetClick}) AS clickers,
  countIf(${M.widgetClick}) AS clicks,
  uniqIf(person_id, ${M.widgetFetchFailed}) AS failed_people
FROM events
WHERE ${IN_PERIOD}
  AND event IN ('$pageview', 'dashboard_widget_clicked', 'dashboard_widget_fetch_failed')${people}`;
}

/** Clicks and people per widget. Values: start, end (exclusive). */
export function clicksByWidget(people: string): string {
  return `
SELECT
  ${WIDGET_ID} AS widget,
  count() AS clicks,
  uniq(person_id) AS people
FROM events
WHERE ${IN_PERIOD}
  AND ${M.widgetClick}${people}
GROUP BY widget
ORDER BY clicks DESC`;
}

/** Clicks and people per widget and action. Values: start, end (exclusive). */
export function clicksByAction(people: string): string {
  return `
SELECT
  ${WIDGET_ID} AS widget,
  properties.action AS action,
  count() AS clicks,
  uniq(person_id) AS people
FROM events
WHERE ${IN_PERIOD}
  AND ${M.widgetClick}${people}
GROUP BY widget, action
ORDER BY clicks DESC`;
}

/** Clicks per widget per day. Values: start, end (exclusive). */
export function clicksDaily(people: string): string {
  return `
SELECT
  toDate(timestamp) AS day,
  ${WIDGET_ID} AS widget,
  count() AS clicks
FROM events
WHERE ${IN_PERIOD}
  AND ${M.widgetClick}${people}
GROUP BY day, widget
ORDER BY day`;
}

// --- Follow-through ---------------------------------------------------------------

/** Listing times per fragment, for joining on the fragment id. */
const LISTINGS_BY_FRAGMENT = `
    SELECT ${FRAGMENT_ID} AS draft, groupArray(timestamp) AS listed_at
    FROM events
    WHERE ${IN_PERIOD}
      AND event IN ('kp_status_changed', 'knowledge_piece_republished')
      AND ${LISTED}
      AND isNotNull(${FRAGMENT_ID})
    GROUP BY draft`;

/**
 * "Create draft" clicks, one per draft, followed through: the draft the same
 * person created right after the click, messages in its chat, and whether it
 * was listed, all within the window. `messaged` and `listed` count drafts;
 * `messages` is the total sent in them. The last step requires a message too,
 * so it never exceeds the step before it. Only the clicks are filtered by
 * person: what follows belongs to them. Values: start, end (exclusive).
 */
export function newDrafts(people: string): string {
  const linked = `d.timestamp >= c.timestamp - INTERVAL 5 SECOND AND d.timestamp <= c.timestamp + INTERVAL ${LINK_SECONDS} SECOND`;
  return `
SELECT
  count() AS clicks,
  countIf(message_count > 0) AS messaged,
  sum(message_count) AS messages,
  countIf(message_count > 0 AND was_listed) AS listed,
  countIf(message_count > 0 AND NOT was_listed AND clicked > now() - INTERVAL ${FOLLOW_WINDOW_DAYS} DAY) AS still_open
FROM (
  SELECT
    k.clicked AS clicked,
    ifNull(k.draft, '') != '' AS has_draft,
    if(has_draft, arrayCount(t -> ${WITHIN_WINDOW("t", "k.clicked")}, m.sent_at), 0) AS message_count,
    has_draft AND arrayExists(t -> ${WITHIN_WINDOW("t", "k.clicked")}, l.listed_at) AS was_listed
  FROM (
    SELECT
      c.uuid AS click,
      any(c.timestamp) AS clicked,
      argMinIf(d.draft, d.timestamp, ${linked}) AS draft,
      argMinIf(d.chat, d.timestamp, ${linked}) AS chat
    FROM (
      SELECT uuid, person_id, timestamp
      FROM events
      WHERE ${IN_PERIOD}
        AND ${M.widgetClick}
        AND properties.action = 'create_fragment_draft'${people}
    ) AS c
    LEFT JOIN (
      SELECT person_id, timestamp, ${FRAGMENT_ID} AS draft, properties.chat_uuid AS chat
      FROM events
      WHERE ${IN_PERIOD}
        AND ${M.draftCreated}
    ) AS d ON c.person_id = d.person_id
    GROUP BY click
  ) AS k
  LEFT JOIN (
    SELECT properties.chat_uuid AS chat, groupArray(timestamp) AS sent_at
    FROM events
    WHERE ${IN_PERIOD}
      AND ${M.draftMessage}
      AND isNotNull(properties.chat_uuid)
    GROUP BY chat
  ) AS m ON k.chat = m.chat
  LEFT JOIN (${LISTINGS_BY_FRAGMENT}
  ) AS l ON k.draft = l.draft
)`;
}

/**
 * Drafts opened from the drafts widget: each "open item" click is matched to
 * the fragment page the same person viewed right after it. Each draft counts
 * once; it is listed when a listing or re-list follows any of its opens within
 * the window. "Still open" = not listed, last opened inside the window.
 * Values: start, end (exclusive).
 */
export function openedDrafts(people: string): string {
  const clicks = `
      SELECT uuid, person_id, timestamp
      FROM events
      WHERE ${IN_PERIOD}
        AND ${M.widgetClick}
        AND ${WIDGET_ID} = '${DRAFTS_WIDGET}'
        AND properties.action = 'open_item'${people}`;
  return `
SELECT
  count() AS opened,
  sum(length(opened_at)) AS linked_clicks,
  countIf(was_listed) AS listed,
  countIf(NOT was_listed AND arrayMax(opened_at) > now() - INTERVAL ${FOLLOW_WINDOW_DAYS} DAY) AS still_open
FROM (
  SELECT
    o.opened_at AS opened_at,
    arrayExists(s -> arrayExists(t -> ${WITHIN_WINDOW("t", "s")}, l.listed_at), o.opened_at) AS was_listed
  FROM (
    SELECT draft, groupArray(clicked) AS opened_at
    FROM (
      SELECT
        c.uuid AS click,
        any(c.timestamp) AS clicked,
        argMinIf(p.draft, p.timestamp, p.timestamp >= c.timestamp AND p.timestamp <= c.timestamp + INTERVAL ${LINK_SECONDS} SECOND) AS draft
      FROM (${clicks}
      ) AS c
      LEFT JOIN (
        SELECT person_id, timestamp, extract(properties.$pathname, '${FRAGMENT_PAGE}') AS draft
        FROM events
        WHERE ${IN_PERIOD}
          AND event = '$pageview'
          AND match(properties.$pathname, '${FRAGMENT_PAGE}')
          AND person_id IN (SELECT person_id FROM (${clicks}
          ))
      ) AS p ON c.person_id = p.person_id
      GROUP BY click
    )
    WHERE ifNull(draft, '') != ''
    GROUP BY draft
  ) AS o
  LEFT JOIN (${LISTINGS_BY_FRAGMENT}
  ) AS l ON o.draft = l.draft
)`;
}

/**
 * A published answer to a request. The old backend sent a completion instead,
 * and production still gets those until the new tracking ships there, so
 * either counts.
 */
const REQUEST_ANSWERED = `((${M.requestAnswered}) OR (${M.requestCompleted}))`;

/**
 * People who opened an assigned request from the widget, and whether they
 * answered a request within the window of one of those clicks. Per person:
 * widget clicks carry no request id to match the answer on.
 * Values: start, end (exclusive).
 */
export function requestFollowThrough(people: string): string {
  return `
SELECT
  count() AS people,
  countIf(did_answer) AS answered,
  countIf(NOT did_answer AND arrayMax(clicked_at) > now() - INTERVAL ${FOLLOW_WINDOW_DAYS} DAY) AS still_open
FROM (
  SELECT
    c.clicked_at AS clicked_at,
    arrayExists(s -> arrayExists(t -> ${WITHIN_WINDOW("t", "s")}, r.answered_at), c.clicked_at) AS did_answer
  FROM (
    SELECT person_id, groupArray(timestamp) AS clicked_at
    FROM events
    WHERE ${IN_PERIOD}
      AND ${M.widgetClick}
      AND ${WIDGET_ID} = '${REQUESTS_WIDGET}'
      AND properties.action = 'open_item'${people}
    GROUP BY person_id
  ) AS c
  LEFT JOIN (
    SELECT person_id, groupArray(timestamp) AS answered_at
    FROM events
    WHERE ${IN_PERIOD}
      AND ${REQUEST_ANSWERED}
    GROUP BY person_id
  ) AS r ON c.person_id = r.person_id
)`;
}

// --- Reliability ------------------------------------------------------------------

/**
 * Failed loads, people affected and retries per widget. A retry worked when
 * the same person's widget didn't fail again right after it.
 * Values: start, end (exclusive).
 */
export function reliabilityByWidget(people: string): string {
  return `
SELECT
  widget,
  sum(length(failed_at)) AS failures,
  countIf(length(failed_at) > 0) AS people,
  sum(length(retried_at)) AS retries,
  sum(arrayCount(r -> NOT arrayExists(f -> f > r AND f <= r + INTERVAL ${RETRY_SECONDS} SECOND, failed_at), retried_at)) AS retries_worked
FROM (
  SELECT
    person_id,
    ${WIDGET_ID} AS widget,
    groupArrayIf(timestamp, ${M.widgetFetchFailed}) AS failed_at,
    groupArrayIf(timestamp, ${M.widgetRetry}) AS retried_at
  FROM events
  WHERE ${IN_PERIOD}
    AND event IN ('dashboard_widget_fetch_failed', 'dashboard_widget_retry_clicked')${people}
  GROUP BY person_id, widget
)
GROUP BY widget
ORDER BY failures DESC`;
}

/** Failed loads per widget per day. Values: start, end (exclusive). */
export function failuresDaily(people: string): string {
  return `
SELECT
  toDate(timestamp) AS day,
  ${WIDGET_ID} AS widget,
  count() AS failures
FROM events
WHERE ${IN_PERIOD}
  AND ${M.widgetFetchFailed}${people}
GROUP BY day, widget
ORDER BY day`;
}
