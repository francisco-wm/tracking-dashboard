import type { EnvKey } from "@/lib/posthog/environments";
import { formatDayMonth } from "@/lib/dates";

import { EDITING_PUBLIC, INTERNAL_PEOPLE } from "../config";
import type { Filters } from "../filters";

/** Shared lines for the "How this is measured" notes. */

export function TimelineNote() {
  return (
    <p>
      <strong>Timelines</strong> are daily, so every event shows on the day it happened. Today is still in
      progress, so it is drawn lighter. The dashed line marks {formatDayMonth(EDITING_PUBLIC)}, when editing
      opened to everyone.
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
        count anywhere on this page. Turn on “Include internal users” to count them. Days are in UTC.
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
