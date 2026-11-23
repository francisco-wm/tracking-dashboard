import { formatDayMonth } from "@/lib/dates";
import type { EnvKey } from "@/lib/posthog/environments";

import { INTERNAL_PEOPLE } from "../config";
import { startTime, trackedSince, type Filters, type Period } from "../filters";

/** Shared lines for the "How this is measured" notes. */

export function RequestsNote() {
  return (
    <p>
      <strong>A request</strong> counts when it is sent: its first assignment (
      <code>knowledge_request_created</code>), not when the AI drafted it. Every request sent in the range is
      followed to today through its id (<code>knowledge_request_uuid</code>; <code>knowledge_request_id</code>{" "}
      on AI suggestions), whoever acted on it, and an event counts whenever it happened. A request sent near
      the end of the range has had less time to be opened, answered or closed. Events only exist from the day
      a project started sending them; when that day falls inside the range, a note at the top says so, because
      anything before it wasn’t recorded.
    </p>
  );
}

export function PeriodNote({ period }: { period: Period }) {
  const { days } = period;
  const since = trackedSince(period);
  const time = startTime(period);
  return (
    <p>
      <strong>Last {days} days</strong> is today and the {days - 1} days before it, by the day a request was
      sent. PostHog’s “-{days}d” also counts the day before that, so its totals can be slightly higher.
      {since && (
        <>
          {" "}
          The new request tracking started on {formatDayMonth(since)}
          {time && ` at ${time} UTC`} in this project, so counting starts there: before it, most of these
          events didn’t exist.{time && ` ${formatDayMonth(since)} only counts the hours from ${time}.`}
        </>
      )}
    </p>
  );
}

export function MediansNote() {
  return (
    <p>
      <strong>Times are medians</strong>: half the requests took less, half took more. One request left for
      months would pull an average far up. They count from the first assignment, when the request was sent,
      not from when the AI detected the gap.
    </p>
  );
}

export function WhoIsCounted({ filters, env, who }: { filters: Filters; env: EnvKey; who: string }) {
  if (filters.excludeInternal) {
    return (
      <p>
        <strong>Internal users are left out:</strong> {INTERNAL_PEOPLE[env].description}. The filter applies
        to {who}; what happens to a request afterwards belongs to it, whoever acts. Turn on “Include internal
        users” to count everyone. Days are in UTC.
      </p>
    );
  }
  return (
    <p>
      Everyone is counted, including internal and test accounts, so numbers can be higher than PostHog
      dashboards that filter those out. Turn off “Include internal users” to leave out requests sent by
      internal users. Days are in UTC.
    </p>
  );
}

/** "Sent in the last 90 days" or "Sent since 28 Oct", for card subtitles. */
export function spanLabel(period: Period): string {
  const since = trackedSince(period);
  return since ? `Sent since ${formatDayMonth(since)}` : `Sent in the last ${period.days} days`;
}
