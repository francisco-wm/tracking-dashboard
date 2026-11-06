// HogQL for the Knowledge Champions dashboard. Each query was checked against
// production (60292) and staging (55666) before being wired in. Values are
// passed as {placeholders}; datetimes are "YYYY-MM-DD 00:00:00" in UTC.
// No test-account filters anywhere: everyone is counted.

import { METRIC_SQL } from "@/lib/posthog/metrics";

const M = METRIC_SQL;

/** Lower bound for "all history" scans (both projects started in 2025). */
export const HISTORY_START = "2020-01-01 00:00:00";

/** Daily counts across both windows. Values: start, end (exclusive). */
export const WINDOW_DAILY = `
SELECT
  toDate(timestamp) AS day,
  countIf(${M.chatMessage}) AS questions,
  countIf(${M.contribution}) AS contributions,
  countIf(${M.newListing}) AS new_listings,
  countIf(${M.relist}) AS relists,
  countIf(${M.click}) AS clicks,
  uniqIf(person_id, ${M.click}) AS clickers
FROM events
WHERE timestamp >= toDateTime({start})
  AND timestamp < toDateTime({end})
  AND event IN ('chat_message_sent', 'knowledge_shared', 'kp_status_changed', 'knowledge_piece_republished', 'reach_email_cta_clicked')
GROUP BY day
ORDER BY day`;

/**
 * Unique people per window. "matched" = the before-window days that line up
 * with the after-window days elapsed so far.
 * Values: start, matched_end, send, end (exclusive).
 */
export const WINDOW_UNIQUES = `
SELECT
  uniqIf(person_id, ${M.chatMessage} AND timestamp < toDateTime({matched_end})) AS asking_before_matched,
  uniqIf(person_id, ${M.chatMessage} AND timestamp < toDateTime({send})) AS asking_before,
  uniqIf(person_id, ${M.chatMessage} AND timestamp >= toDateTime({send})) AS asking_after,
  uniqIf(person_id, ${M.contribution} AND timestamp < toDateTime({matched_end})) AS contributing_before_matched,
  uniqIf(person_id, ${M.contribution} AND timestamp < toDateTime({send})) AS contributing_before,
  uniqIf(person_id, ${M.contribution} AND timestamp >= toDateTime({send})) AS contributing_after,
  uniqIf(person_id, ${M.active} AND timestamp < toDateTime({matched_end})) AS active_before_matched,
  uniqIf(person_id, ${M.active} AND timestamp < toDateTime({send})) AS active_before,
  uniqIf(person_id, ${M.active} AND timestamp >= toDateTime({send})) AS active_after,
  uniqIf(person_id, ${M.click} AND timestamp >= toDateTime({send})) AS clickers_after
FROM events
WHERE timestamp >= toDateTime({start})
  AND timestamp < toDateTime({end})
  AND event IN ('chat_message_sent', 'knowledge_shared', '$pageview', 'reach_email_cta_clicked')`;

/** People whose first-ever new listing falls in the windows. Values: history_start, start, end. */
export const FIRST_TIME_CREATORS = `
SELECT
  toDate(first_ts) AS day,
  count() AS creators
FROM (
  -- each person's first ever listing, across all history
  SELECT
    person_id,
    min(timestamp) AS first_ts
  FROM events
  WHERE ${M.newListing}
    AND timestamp >= toDateTime({history_start})
    AND timestamp < toDateTime({end})
  GROUP BY person_id
)
WHERE first_ts >= toDateTime({start})
GROUP BY day
ORDER BY day`;

/** Monday-week series. Values: start, end (exclusive). */
export const WEEKLY = `
SELECT
  toStartOfWeek(timestamp, 1) AS week,
  countIf(${M.chatMessage}) AS questions,
  uniqIf(person_id, ${M.chatMessage}) AS people_asking,
  countIf(${M.contribution}) AS contributions,
  uniqIf(person_id, ${M.contribution}) AS contributors,
  countIf(${M.newListing}) AS new_listings,
  countIf(${M.relist}) AS relists,
  uniqIf(person_id, ${M.active}) AS active_people
FROM events
WHERE timestamp >= toDateTime({start})
  AND timestamp < toDateTime({end})
  AND event IN ('chat_message_sent', 'knowledge_shared', 'kp_status_changed', 'knowledge_piece_republished', '$pageview')
GROUP BY week
ORDER BY week`;

/**
 * Weekly lifecycle on $pageview, Monday weeks:
 * new = first active week ever; returning = active this week and last week;
 * came back = active this week, not last week, not their first week;
 * dropped off = active last week, not this week.
 * Values: history_start, prev_start (week before the range), end, first_week, last_week.
 */
export const LIFECYCLE = `
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
    WHERE ${M.active}
      AND timestamp >= toDateTime({history_start})
      AND timestamp < toDateTime({end})
    GROUP BY person_id
  )
)
WHERE week >= toDate({first_week})
  AND week <= toDate({last_week})
GROUP BY week
ORDER BY week`;

/** New listings per day. Values: start, end (exclusive). */
export const LISTINGS_DAILY = `
SELECT
  toDate(timestamp) AS day,
  count() AS new_listings
FROM events
WHERE ${M.newListing}
  AND timestamp >= toDateTime({start})
  AND timestamp < toDateTime({end})
GROUP BY day
ORDER BY day`;

/** When each metric was first tracked (1970-01-01 = never). Values: history_start, end. */
export const TRACKING_START = `
SELECT
  minIf(timestamp, ${M.chatMessage}) AS chatMessage,
  minIf(timestamp, ${M.contribution}) AS contribution,
  minIf(timestamp, ${M.newListing}) AS newListing,
  minIf(timestamp, ${M.relist}) AS relist,
  minIf(timestamp, ${M.click}) AS click,
  minIf(timestamp, ${M.active}) AS active
FROM events
WHERE timestamp >= toDateTime({history_start})
  AND timestamp < toDateTime({end})
  AND event IN ('chat_message_sent', 'knowledge_shared', 'kp_status_changed', 'knowledge_piece_republished', 'reach_email_cta_clicked', '$pageview')`;

/**
 * One row per person who clicked since the send, from their first click:
 * activity in the 7 days before vs after, plus funnel flags. "Listed" is a
 * new listing or a re-list within 7 days of the click, in any order.
 * Values: events_start (send - 7 days), send, end (exclusive).
 */
export const CLICKERS = `
SELECT
  toString(person_id) AS person_id,
  person_name,
  first_click,
  arrayCount(x -> x.1 = 'question' AND x.2 >= first_click - INTERVAL 7 DAY AND x.2 < first_click, evts) AS questions_before,
  arrayCount(x -> x.1 = 'question' AND x.2 > first_click AND x.2 <= first_click + INTERVAL 7 DAY, evts) AS questions_after,
  arrayCount(x -> x.1 = 'contribution' AND x.2 >= first_click - INTERVAL 7 DAY AND x.2 < first_click, evts) AS contributions_before,
  arrayCount(x -> x.1 = 'contribution' AND x.2 > first_click AND x.2 <= first_click + INTERVAL 7 DAY, evts) AS contributions_after,
  arrayCount(x -> x.1 = 'new_listing' AND x.2 >= first_click - INTERVAL 7 DAY AND x.2 < first_click, evts) AS listings_before,
  arrayCount(x -> x.1 = 'new_listing' AND x.2 > first_click AND x.2 <= first_click + INTERVAL 7 DAY, evts) AS listings_after,
  arrayCount(x -> x.1 = 'relist' AND x.2 >= first_click - INTERVAL 7 DAY AND x.2 < first_click, evts) AS relists_before,
  arrayCount(x -> x.1 = 'relist' AND x.2 > first_click AND x.2 <= first_click + INTERVAL 7 DAY, evts) AS relists_after,
  arrayExists(x -> x.1 IN ('question', 'contribution') AND x.2 > first_click AND x.2 <= first_click + INTERVAL 1 DAY, evts) AS acted_within_24h,
  arrayExists(x -> x.1 = 'contribution' AND x.2 > first_click AND x.2 <= first_click + INTERVAL 7 DAY, evts) AS contributed_within_7d,
  -- any order: people often publish before their first knowledge_shared fires
  arrayExists(x -> x.1 IN ('new_listing', 'relist') AND x.2 > first_click AND x.2 <= first_click + INTERVAL 7 DAY, evts) AS listed_within_7d
FROM (
  SELECT
    person_id,
    coalesce(toString(any(person.properties.name)), '') AS person_name,
    minIf(timestamp, ${M.click} AND timestamp >= toDateTime({send})) AS first_click,
    groupArray(tuple(
      multiIf(
        ${M.chatMessage}, 'question',
        ${M.contribution}, 'contribution',
        ${M.newListing}, 'new_listing',
        ${M.relist}, 'relist',
        'other'
      ),
      timestamp
    )) AS evts
  FROM events
  WHERE timestamp >= toDateTime({events_start})
    AND timestamp < toDateTime({end})
    AND event IN ('reach_email_cta_clicked', 'chat_message_sent', 'knowledge_shared', 'kp_status_changed', 'knowledge_piece_republished')
  GROUP BY person_id
  HAVING countIf(${M.click} AND timestamp >= toDateTime({send})) > 0
)
ORDER BY first_click`;
