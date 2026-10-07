// HogQL for the Fragment editing dashboard. Each query was checked against
// production (60292) and staging (55666) before being wired in. Values are
// passed as {placeholders}; datetimes are "YYYY-MM-DD 00:00:00" in UTC.
// Internal users are only dropped when the viewer asks: `people` is then an
// AND clause built from INTERNAL_PEOPLE, otherwise "" and everyone is counted.

import { FRAGMENT_ID, METRIC_SQL } from "@/lib/posthog/metrics";

import { COMPLETION_WINDOW_DAYS } from "./config";

const M = METRIC_SQL;

/** "" when everyone is counted; otherwise a clause that drops internal users' events. */
export function peopleFilter(internalSql: string | null): string {
  return internalSql ? `\n  AND NOT (${internalSql})` : "";
}

/** Totals over the period. Values: start, end (exclusive). */
export function listingTotals(people: string): string {
  return `
SELECT
  countIf(${M.newListing}) AS new_listings,
  countIf(${M.relist}) AS relists,
  uniqIf(${FRAGMENT_ID}, ${M.relist}) AS relisted_fragments
FROM events
WHERE timestamp >= toDateTime({start})
  AND timestamp < toDateTime({end})
  AND event IN ('kp_status_changed', 'knowledge_piece_republished')${people}`;
}

/** New listings and re-lists per day. Values: start, end (exclusive). */
export function listingsDaily(people: string): string {
  return `
SELECT
  toDate(timestamp) AS day,
  countIf(${M.newListing}) AS new_listings,
  countIf(${M.relist}) AS relists
FROM events
WHERE timestamp >= toDateTime({start})
  AND timestamp < toDateTime({end})
  AND event IN ('kp_status_changed', 'knowledge_piece_republished')${people}
GROUP BY day
ORDER BY day`;
}

/** One row per fragment with an edit started since {start}: its edit starts and re-lists. */
function editedFragments(people: string): string {
  return `
  SELECT
    ${FRAGMENT_ID} AS fragment,
    groupArrayIf(timestamp, ${M.editStarted}) AS starts,
    groupArrayIf(timestamp, ${M.relist}) AS relists
  FROM events
  WHERE timestamp >= toDateTime({start})
    AND timestamp < toDateTime({end})
    AND event IN ('knowledge_piece_edit_started', 'knowledge_piece_republished')
    AND isNotNull(${FRAGMENT_ID})${people}
  GROUP BY fragment
  HAVING length(starts) > 0`;
}

/**
 * One row per edit: each edit start since {start}, in order per fragment.
 * Fragment ids never change, so an edit is listed when a re-list of its
 * fragment follows within the window and before the fragment's next edit
 * start: one re-list never completes two edits. `is_latest` marks the
 * fragment's newest edit; an older unlisted one was carried on by it.
 */
function editRows(people: string): string {
  return `
  SELECT
    fragment,
    s,
    i = length(sorted) AS is_latest,
    arrayExists(
      r -> r >= s
        AND r <= s + INTERVAL ${COMPLETION_WINDOW_DAYS} DAY
        AND (i = length(sorted) OR r < sorted[i + 1]),
      relists
    ) AS done
  FROM (
    SELECT fragment, relists, arraySort(starts) AS sorted
    FROM (${editedFragments(people)}
    )
  )
  ARRAY JOIN sorted AS s, arrayEnumerate(sorted) AS i`;
}

/**
 * Edit completion per edit: edits started, how many were listed within 30
 * days, and how many are still in draft (not listed, the fragment's newest
 * edit, started inside the window, so it can still count).
 * Values: start, end (exclusive).
 */
export function completionTotals(people: string): string {
  return `
SELECT
  count() AS started,
  uniq(fragment) AS fragments,
  countIf(done) AS listed,
  countIf(NOT done AND is_latest AND s > now() - INTERVAL ${COMPLETION_WINDOW_DAYS} DAY) AS still_in_draft
FROM (${editRows(people)}
)`;
}

/** Edit completion by the day each edit started. Values: start, end (exclusive). */
export function completionDaily(people: string): string {
  return `
SELECT
  toStartOfDay(s) AS day,
  count() AS started,
  countIf(done) AS listed
FROM (${editRows(people)}
)
GROUP BY day
ORDER BY day`;
}
