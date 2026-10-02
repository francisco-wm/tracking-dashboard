import type { EnvKey } from "@/lib/posthog/environments";
import { formatDayMonth } from "@/lib/dates";

import { INTERNAL_PEOPLE, TRACKING_STARTED } from "../config";
import { trackedSince, type Filters, type Period } from "../filters";

/** Shared lines for the "How this is measured" notes. */

export function TimelineNote() {
  return (
    <p>
      <strong>Timelines</strong> are daily, so every event shows on the day it happened. Today is still in
      progress, so it is drawn lighter. The dashed line marks {formatDayMonth(TRACKING_STARTED)}, when widget
      tracking started; the days before it have no data.
    </p>
  );
}

export function HomePageNote() {
  return (
    <p>
      <strong>Home-page visitors</strong> are people with a page view of an organisation’s home page (
      <code>/o/&lt;organisation&gt;</code>), the only place the widgets are shown. Every widget is shown to
      everyone there.
    </p>
  );
}

export function PeriodNote({ period }: { period: Period }) {
  const { days } = period;
  const since = trackedSince(period);
  return (
    <p>
      <strong>Last {days} days</strong> is today and the {days - 1} days before it. PostHog’s “-{days}d” also
      counts the day before that, so its totals can be slightly higher.
      {since && (
        <>
          {" "}
          Widget tracking started on {formatDayMonth(since)}, so counting starts there, home-page visits
          included: shares compare the same days. Staging’s earlier test clicks are left out.
        </>
      )}
    </p>
  );
}

export function WhoIsCounted({ filters, env }: { filters: Filters; env: EnvKey }) {
  if (filters.excludeInternal) {
    return (
      <p>
        <strong>Internal users are left out:</strong> {INTERNAL_PEOPLE[env].description}. Their events don’t
        count anywhere on this page. Days are in UTC.
      </p>
    );
  }
  return (
    <p>
      Everyone is counted, including internal and test accounts, so numbers can be higher than PostHog
      dashboards that filter those out. Turn off “Include internal users” to leave them out. Days are in UTC.
    </p>
  );
}
