// HogQL for Adoption v2. Each query was checked against production (60292)
// and staging (55666) before being wired in. Values are {placeholders};
// datetimes are "YYYY-MM-DD hh:mm:ss" in UTC, weeks start on Monday.
// Active means a core action (METRIC_SQL.coreAction), not a page view. The
// organisation is `properties.organization_uuid`, on every custom event.
// `people` is "" when everyone is counted, else an AND clause from
// INTERNAL_PEOPLE; it drops internal users' events everywhere.
// ponytail: that includes an internal person answering a customer's request
// or deleting a customer's fragment; filter per event if that ever matters.

import { METRIC_SQL, ORG_ID } from "@/lib/posthog/metrics";

const M = METRIC_SQL;

const CORE_EVENTS = `'chat_message_sent', 'knowledge_piece_created', 'knowledge_piece_edit_started', 'kp_status_changed', 'knowledge_piece_republished', 'attached_source', 'knowledge_request_created', 'knowledge_request_answered', 'knowledge_request_completed'`;

/**
 * Per week: active people and organisations, the knowledge loop's supply and
 * demand, registrations (and how many came through an invite), knowledge
 * requests sent and answer ratings. Values: history_start, start, end.
 */
export function weekly(people: string): string {
  return `
SELECT
  toStartOfWeek(timestamp, 1) AS week,
  uniqIf(person_id, ${M.coreAction}) AS active,
  uniqIf(${ORG_ID}, ${M.coreAction}) AS orgs,
  countIf(${M.chatMessage}) AS questions,
  uniqIf(person_id, ${M.chatMessage}) AS askers,
  -- knowledge going in, i.e. what answers can cite: listings (new or edited) and uploads
  countIf(${M.newListing}) AS fragments_listed,
  countIf(${M.relist}) AS fragments_relisted,
  countIf(${M.fileUploaded}) AS files_uploaded,
  uniqIf(person_id, (${M.newListing}) OR ${M.relist} OR ${M.fileUploaded}) AS contributors,
  countIf(${M.fileAttached}) AS files_attached,
  -- what active people did: each of these people is active that week
  uniqIf(person_id, ${M.draftCreated} AND NOT ${M.fileUploaded}) AS people_drafting,
  uniqIf(person_id, ${M.fileUploaded}) AS people_uploading,
  uniqIf(person_id, ${M.editStarted}) AS people_editing,
  uniqIf(person_id, (${M.newListing}) OR ${M.relist}) AS people_listing,
  uniqIf(person_id, ${M.fileAttached}) AS people_attaching,
  uniqIf(person_id, ${M.requestSent}) AS people_requesting,
  uniqIf(person_id, ${M.requestAnswered} OR ${M.requestCompleted}) AS people_answering,
  countIf(${M.requestSent}) AS requests,
  countIf(${M.registered}) AS registrations,
  countIf(${M.registered} AND person_id IN (
    SELECT person_id FROM events WHERE ${M.inviteAccepted} AND timestamp >= toDateTime({history_start})
  )) AS invited,
  countIf(${M.answerRated} AND toFloat(properties.rating) > 0) AS rated_up,
  countIf(${M.answerRated} AND toFloat(properties.rating) < 0) AS rated_down
FROM events
WHERE timestamp >= toDateTime({start})
  AND timestamp < toDateTime({end})
  AND event IN (${CORE_EVENTS}, 'user_created', 'chat_response_rated')${people}
GROUP BY week
ORDER BY week`;
}

/**
 * Chat questions and how many got a sourced answer, per week and organisation.
 * There is no answer event: a question is sourced when at least one fragment
 * is cited in its chat before the chat's next message. Citations carry the
 * chat as conversation_id, messages as chat_uuid. Values: start, end.
 */
export function answers(people: string): string {
  return `
SELECT
  toStartOfWeek(asked_at, 1) AS week,
  question_org AS org,
  count() AS questions,
  countIf(cited > 0) AS sourced
FROM (
  SELECT
    chat,
    turn,
    minIf(timestamp, event = 'chat_message_sent') AS asked_at,
    anyIf(org, event = 'chat_message_sent') AS question_org,
    anyIf(chat_type, event = 'chat_message_sent') AS question_type,
    countIf(event = 'knowledge_fragment_used_in_response' AND usage = 'cited') AS cited
  FROM (
    SELECT
      event,
      timestamp,
      chat,
      usage,
      chat_type,
      org,
      -- every citation belongs to the latest message before it in the same chat
      sum(if(event = 'chat_message_sent', 1, 0)) OVER (
        PARTITION BY chat
        ORDER BY timestamp, if(event = 'chat_message_sent', 0, 1)
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS turn
    FROM (
      SELECT
        event,
        timestamp,
        if(event = 'chat_message_sent', toString(properties.chat_uuid), toString(properties.conversation_id)) AS chat,
        toString(properties.usage) AS usage,
        toString(properties.chat_type) AS chat_type,
        ${ORG_ID} AS org
      FROM events
      WHERE timestamp >= toDateTime({start})
        AND timestamp < toDateTime({end})
        AND event IN ('chat_message_sent', 'knowledge_fragment_used_in_response')${people}
    )
  )
  GROUP BY chat, turn
)
WHERE turn > 0
  AND question_type = 'chat'
GROUP BY week, question_org
ORDER BY week
LIMIT 10000`;
}

/**
 * One row per organisation: its name (only shown when the viewer asks),
 * seats, active people in each of the 4 weeks ending last week, its latest
 * core action, and chat messages, knowledge in (listings, re-listed edits and
 * uploads) and requests in those 4 weeks.
 * Seats are approximate: people seen on the organisation's events, minus
 * anyone who left. Values: history_start, end, w1, w2, w3, w4 (Mondays of the
 * 4 weeks, w4 = last week), this_week.
 */
export function organisations(people: string): string {
  const inWeek = (from: string, to: string) =>
    `countIf(${M.coreAction} AND timestamp >= toDateTime({${from}}) AND timestamp < toDateTime({${to}})) > 0`;
  const inFourWeeks = `timestamp >= toDateTime({w1}) AND timestamp < toDateTime({this_week})`;
  return `
SELECT
  org,
  argMax(name, last_seen) AS name,
  countIf(NOT has_left) AS seats,
  countIf(a1) AS w1,
  countIf(a2) AS w2,
  countIf(a3) AS w3,
  countIf(a4) AS w4,
  toString(max(last_core)) AS last_activity,
  sum(questions) AS questions,
  sum(knowledge) AS knowledge_in,
  sum(requests) AS requests
FROM (
  SELECT
    ${ORG_ID} AS org,
    person_id,
    argMax(toString(properties.organization_name), timestamp) AS name,
    max(timestamp) AS last_seen,
    countIf(${M.leftOrg}) > 0 AS has_left,
    ${inWeek("w1", "w2")} AS a1,
    ${inWeek("w2", "w3")} AS a2,
    ${inWeek("w3", "w4")} AS a3,
    ${inWeek("w4", "this_week")} AS a4,
    maxIf(timestamp, ${M.coreAction}) AS last_core,
    countIf(${M.chatMessage} AND ${inFourWeeks}) AS questions,
    countIf(((${M.newListing}) OR ${M.relist} OR ${M.fileUploaded}) AND ${inFourWeeks}) AS knowledge,
    countIf(${M.requestSent} AND ${inFourWeeks}) AS requests
  FROM events
  WHERE timestamp >= toDateTime({history_start})
    AND timestamp < toDateTime({end})
    AND NOT startsWith(event, '$')
    AND notEmpty(${ORG_ID})${people}
  GROUP BY org, person_id
)
GROUP BY org
ORDER BY org
LIMIT 1000`;
}

/**
 * One row per person registered or active since {start}: their registration
 * week (1970 when it was earlier) and every week with a core action. Feeds the
 * cohort table and the weekly composition. Values: start, end.
 */
export function personWeeks(people: string): string {
  return `
SELECT
  toString(registered_week) AS registered,
  arrayMap(w -> toString(w), weeks) AS active_weeks
FROM (
  SELECT
    person_id,
    minIf(toStartOfWeek(timestamp, 1), ${M.registered}) AS registered_week,
    groupUniqArrayIf(toStartOfWeek(timestamp, 1), ${M.coreAction}) AS weeks
  FROM events
  WHERE timestamp >= toDateTime({start})
    AND timestamp < toDateTime({end})
    AND event IN (${CORE_EVENTS}, 'user_created')${people}
  GROUP BY person_id
)
WHERE notEmpty(weeks) OR registered_week >= toDate({start})
LIMIT 10000`;
}

/**
 * One row per person registered in [from, to): when, whether through an
 * invite, and their core actions up to day 28 and citations up to day 14,
 * registration day being day 1. The funnel is worked out from these.
 * Values: from, to, end.
 */
export function registrations(people: string): string {
  return `
SELECT
  toString(registered_at) AS registered,
  invited,
  arrayMap(t -> toString(t), arraySort(arrayFilter(t -> t >= registered_at AND t < toStartOfDay(registered_at) + INTERVAL 28 DAY, core))) AS core_times,
  arrayMap(t -> toString(t), arraySort(arrayFilter(t -> t >= registered_at AND t < toStartOfDay(registered_at) + INTERVAL 14 DAY, cited))) AS cited_times
FROM (
  SELECT
    person_id,
    minIf(timestamp, ${M.registered}) AS registered_at,
    countIf(${M.inviteAccepted}) > 0 AS invited,
    groupArrayIf(timestamp, ${M.coreAction}) AS core,
    groupArrayIf(timestamp, ${M.cited}) AS cited
  FROM events
  WHERE timestamp >= toDateTime({from})
    AND timestamp < toDateTime({end})
    AND event IN (${CORE_EVENTS}, 'user_created', 'invitation_accepted', 'knowledge_fragment_used_in_response')${people}
  GROUP BY person_id
)
WHERE registered_at >= toDateTime({from})
  AND registered_at < toDateTime({to})
ORDER BY registered_at
LIMIT 10000`;
}

/** Invites sent in [from, to), and how many were accepted within 14 days. Values: from, to, end. */
export function invites(people: string): string {
  return `
SELECT
  count() AS sent,
  countIf(accepted_at >= sent_at AND accepted_at < sent_at + INTERVAL 14 DAY) AS accepted
FROM (
  SELECT
    toString(properties.invitation_uuid) AS invitation,
    minIf(timestamp, ${M.inviteSent}) AS sent_at,
    minIf(timestamp, ${M.inviteAccepted}) AS accepted_at
  FROM events
  WHERE timestamp >= toDateTime({from})
    AND timestamp < toDateTime({end})
    AND event IN ('invitation_created', 'invitation_accepted')${people}
  GROUP BY invitation
)
WHERE sent_at >= toDateTime({from})
  AND sent_at < toDateTime({to})`;
}

/**
 * Knowledge requests sent since {start} (the later of the period and the new
 * answer tracking) and how many have at least one answer, by the week sent.
 * Values: start, end.
 */
export function requests(people: string): string {
  return `
SELECT
  toStartOfWeek(sent_at, 1) AS week,
  count() AS sent,
  countIf(has_answer) AS answered,
  countIf(was_resolved) AS resolved
FROM (
  SELECT
    toString(properties.knowledge_request_uuid) AS request,
    minIf(timestamp, ${M.requestSent}) AS sent_at,
    countIf(${M.requestAnswered}) > 0 AS has_answer,
    countIf(${M.requestClosed} AND properties.outcome = 'resolved') > 0 AS was_resolved
  FROM events
  WHERE timestamp >= toDateTime({start})
    AND timestamp < toDateTime({end})
    AND event IN ('knowledge_request_created', 'knowledge_request_answered', 'knowledge_request_closed')${people}
  GROUP BY request
)
WHERE sent_at >= toDateTime({start})
GROUP BY week
ORDER BY week`;
}

/**
 * Reuse, as of now: knowledge answers can cite (fragments whose latest status
 * is published, and files uploaded to company knowledge, not archived or
 * deleted since) and how much of it was cited since {cited_from}; the people
 * who created it, and how many of them had some of it cited since
 * {authors_from}. Values: history_start, end, cited_from, authors_from.
 */
export function reuse(people: string): string {
  const available = `NOT deleted AND (status = 'published' OR (is_file AND status != 'archived'))`;
  return `
SELECT
  countIf(${available}) AS available,
  countIf(${available} AND cited_recently) AS cited_available,
  uniqIf(author, ${available} AND has_author) AS authors,
  uniqIf(author, ${available} AND has_author AND cited_for_authors) AS cited_authors
FROM (
  SELECT
    if(event = 'knowledge_fragment_used_in_response', toString(properties.knowledge_fragment_id), toString(properties.knowledge_piece_uuid)) AS fragment,
    argMaxIf(toString(properties.to_status), timestamp, event = 'kp_status_changed') AS status,
    countIf(${M.fileUploaded}) > 0 AS is_file,
    countIf(event = 'knowledge_piece_deleted') > 0 AS deleted,
    countIf(${M.cited} AND timestamp >= toDateTime({cited_from})) > 0 AS cited_recently,
    countIf(${M.cited} AND timestamp >= toDateTime({authors_from})) > 0 AS cited_for_authors,
    countIf(${M.draftCreated}) > 0 AS has_author,
    argMinIf(person_id, timestamp, ${M.draftCreated}) AS author
  FROM events
  WHERE timestamp >= toDateTime({history_start})
    AND timestamp < toDateTime({end})
    AND event IN ('kp_status_changed', 'knowledge_piece_deleted', 'knowledge_fragment_used_in_response', 'knowledge_piece_created')${people}
  GROUP BY fragment
)`;
}
