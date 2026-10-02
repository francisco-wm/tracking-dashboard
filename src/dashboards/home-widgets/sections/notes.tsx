import type { EnvKey } from "@/lib/posthog/environments";
import { formatDayMonth } from "@/lib/dates";

import { INTERNAL_PEOPLE, WIDGETS_LIVE } from "../config";
import type { Filters } from "../filters";

/** Shared lines for the "How this is measured" notes. */

export function TimelineNote({ env }: { env: EnvKey }) {
  return (
    <p>
      <strong>Timelines</strong> are daily, so every event shows on the day it happened. Today is still in
      progress, so it is drawn lighter. The dashed line marks {formatDayMonth(WIDGETS_LIVE[env])}, the first
      widget click in this environment.
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

export function PeriodNote({ days }: { days: number }) {
  return (
    <p>
      <strong>Last {days} days</strong> is today and the {days - 1} days before it. PostHog’s “-{days}d” also
      counts the day before that, so its totals can be slightly higher.
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
