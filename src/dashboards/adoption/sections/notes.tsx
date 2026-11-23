import type { EnvKey } from "@/lib/posthog/environments";

import { INTERNAL_PEOPLE } from "../config";
import type { Filters, Period } from "../filters";

/** Shared lines for the "How this is measured" notes. */

export function ActiveNote() {
  return (
    <p>
      <strong>Active</strong> means at least one page view inside an organisation’s app (
      <code>$pageview</code> on <code>/o/&lt;organisation&gt;/…</code>, or{" "}
      <code>/dashboard/&lt;organisation&gt;/…</code> before July 2026): signed in and using wingmaite.
      Sign-in, sign-up and setup pages don’t count. Most people who only ever see those never sign in, and
      counting them would more than double some weeks.
    </p>
  );
}

export function WeeksNote({ period }: { period: Period }) {
  return (
    <p>
      <strong>Weeks</strong> start on Monday, in UTC, over the last {period.weeks} weeks. This week is still
      in progress, so it is drawn lighter; headline numbers use last week, the latest complete one.
    </p>
  );
}

export function WhoIsCounted({ filters, env }: { filters: Filters; env: EnvKey }) {
  if (filters.excludeInternal) {
    return (
      <p>
        <strong>Internal users are left out:</strong> {INTERNAL_PEOPLE[env].description}. Their events don’t
        count anywhere on this page. Turn on “Include internal users” to count them.
      </p>
    );
  }
  return (
    <p>
      Everyone is counted, including internal and test accounts, so numbers can be higher than PostHog
      dashboards that filter those out. Turn off “Include internal users” to leave them out.
    </p>
  );
}
