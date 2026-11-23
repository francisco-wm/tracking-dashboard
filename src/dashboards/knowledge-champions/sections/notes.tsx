import type { DashboardContext } from "@/dashboards/types";
import { formatDayMonth, type ISODate } from "@/lib/dates";

import { INTERNAL_PEOPLE } from "../config";
import { parseFilters } from "../filters";

/** Shared lines for the "How this is measured" notes. */

export function WeeklyNote() {
  return (
    <p>
      <strong>Weekly charts</strong> use Monday-start weeks over the last 6 months. The current week is still
      in progress, so it is drawn lighter. The dashed line marks the week of each send.
    </p>
  );
}

export function WhoIsCounted({ ctx }: { ctx: DashboardContext }) {
  if (parseFilters(ctx.searchParams).excludeInternal) {
    return (
      <p>
        <strong>Internal users are left out:</strong> {INTERNAL_PEOPLE[ctx.env].description}. Their events
        don’t count anywhere on this page. Turn on “Include internal users” to count them. Days and weeks are
        in UTC.
      </p>
    );
  }
  return (
    <p>
      Everyone is counted, including internal and test accounts, so numbers can be higher than PostHog
      dashboards that filter those out. Turn off “Include internal users” to leave them out. Days and weeks
      are in UTC.
    </p>
  );
}

/**
 * A metric whose first event falls after the before window started can't be
 * compared fairly: say so.
 */
export function trackingCaveat(
  metric: string,
  firstSeen: ISODate | null,
  beforeStart: ISODate,
): string | null {
  if (firstSeen === null) return `${metric} has not been tracked in this environment yet.`;
  if (firstSeen <= beforeStart) return null;
  return `${metric} has only been tracked since ${formatDayMonth(firstSeen)}, so the before window is incomplete.`;
}
