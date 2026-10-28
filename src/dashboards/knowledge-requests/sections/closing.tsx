import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";

import { ShareBar } from "../charts/share-bar";
import { WaitingCard } from "../charts/waiting";
import { COLORS, STALE_DAYS, type DataKey } from "../config";
import { krContext, loadRequests, loadTracking } from "../data";
import { share, trackedSince, type Filters, type Period } from "../filters";
import { closingSummary, formatDuration, type ClosingSummary } from "../lifecycle";
import { closingSentence, plural, trackingNote, waitingSentence } from "../sentences";
import { isTracked, missing, startedInPeriod } from "../tracking";
import { MediansNote, PeriodNote, RequestsNote, WhoIsCounted, spanLabel } from "./notes";

interface ClosingData {
  period: Period;
  filters: Filters;
  closing: {
    requests: number;
    summary: ClosingSummary;
    /** Open requests can only be split by answers once answers are tracked. */
    answersTracked: boolean;
  } | null;
  waiting: DataKey[];
  /** Data used here that first appeared inside the range. */
  note: string | null;
}

async function load(ctx: DashboardContext) {
  const kr = krContext(ctx);
  const [tracking, requests] = await Promise.all([loadTracking(ctx, kr), loadRequests(ctx, kr)]);
  const { status } = tracking;
  const answersTracked = status.answered !== null;
  const keys: DataKey[] = answersTracked ? ["sent", "closed", "answered"] : ["sent", "closed"];
  const { rows } = requests;
  return {
    data: {
      period: kr.period,
      filters: kr.filters,
      closing: isTracked(status, keys)
        ? { requests: rows.length, summary: closingSummary(rows, requests.now), answersTracked }
        : null,
      waiting: missing(status, ["sent", "closed"]),
      note: trackingNote(startedInPeriod(status, kr.period, keys)),
    } satisfies ClosingData,
    asOf: oldest(tracking.fetchedAt, requests.fetchedAt),
  };
}

const pct = (value: number | null) => (value === null ? "–" : formatNumber(value, "percent"));

function View({ data, ctx }: { data: ClosingData; ctx: DashboardContext }) {
  const { period, filters, closing, waiting } = data;
  const howMeasured = (
    <>
      <p>
        The first version has no reminders and no auto-close, so closing a request is up to the requester.
        This tab says whether that holds up: if answered requests pile up unclosed, add a closure nudge or
        auto-close; if requesters close them reliably, keep it as it is.
      </p>
      <p>
        <strong>Resolved</strong> and <strong>cancelled</strong> come from{" "}
        <code>knowledge_request_closed</code> and its <code>outcome</code>; a request closed more than once
        counts by its latest close. <strong>Time to resolve</strong> is the median of{" "}
        <code>seconds_open</code> over resolved requests. <strong>Open, has answers</strong> means at least
        one <code>knowledge_request_answered</code> and no close yet.{" "}
        <strong>Answered, open over {STALE_DAYS} days</strong> counts those sent more than {STALE_DAYS} days
        ago.
      </p>
      <RequestsNote />
      <MediansNote />
      <PeriodNote period={period} />
      <WhoIsCounted filters={filters} env={ctx.env} who="the person who sent each request" />
    </>
  );

  if (!closing) {
    return (
      <SectionFrame sentence={waitingSentence(waiting)} howMeasured={howMeasured}>
        <WaitingCard className="lg:col-span-6" title="Do requesters close the loop?" keys={waiting}>
          Resolved and cancelled requests, time to resolve, and answered requests left open.
        </WaitingCard>
      </SectionFrame>
    );
  }

  const { requests, summary, answersTracked } = closing;
  const { counts } = summary;
  const open = counts.openAnswered + counts.openUnanswered;

  return (
    <SectionFrame
      sentence={closingSentence({
        days: period.days,
        since: trackedSince(period),
        requests,
        resolved: counts.resolved,
        cancelled: counts.cancelled,
        openAnswered: answersTracked ? counts.openAnswered : null,
      })}
      notes={[
        ...(data.note ? [data.note] : []),
        ...(answersTracked && summary.staleAnswered > 0
          ? [
              `${plural(summary.staleAnswered, "request has", "requests have")} answers but ${summary.staleAnswered === 1 ? "has" : "have"} been open for more than ${STALE_DAYS} days.`,
            ]
          : []),
      ]}
      howMeasured={howMeasured}
    >
      <div className="lg:col-span-2">
        <StatTile
          title="Resolved"
          value={pct(share(counts.resolved, requests))}
          caption={`${formatNumber(counts.resolved)} of ${plural(requests, "request")}; ${formatNumber(counts.cancelled)} cancelled`}
        />
      </div>
      <div className="lg:col-span-2">
        <StatTile
          title="Time to resolve"
          value={summary.medianToResolve === null ? "–" : formatDuration(summary.medianToResolve)}
          caption={
            counts.resolved > 0
              ? `Median over ${plural(counts.resolved, "resolved request")}`
              : "None resolved yet"
          }
        />
      </div>
      <div className="lg:col-span-2">
        {answersTracked ? (
          <StatTile
            title={`Answered, open over ${STALE_DAYS} days`}
            value={formatNumber(summary.staleAnswered)}
            caption={`Of ${plural(counts.openAnswered, "answered request")} still open`}
          />
        ) : (
          <WaitingCard title={`Answered, open over ${STALE_DAYS} days`} keys={["answered"]}>
            Answered requests nobody has closed.
          </WaitingCard>
        )}
      </div>
      <ShareBar
        className="lg:col-span-6"
        title="Do requesters close the loop?"
        subtitle={spanLabel(period)}
        unit="Requests"
        segments={[
          { key: "resolved", label: "Resolved", count: counts.resolved, color: COLORS.good },
          { key: "cancelled", label: "Cancelled", count: counts.cancelled, color: COLORS.neutral },
          ...(answersTracked
            ? [
                {
                  key: "openAnswered",
                  label: "Open, has answers",
                  count: counts.openAnswered,
                  color: COLORS.attention,
                },
                {
                  key: "openUnanswered",
                  label: "Open, no answers",
                  count: counts.openUnanswered,
                  color: COLORS.pending,
                },
              ]
            : [{ key: "open", label: "Still open", count: open, color: COLORS.pending }]),
        ]}
      />
    </SectionFrame>
  );
}

export const closingSection: SectionModule<ClosingData> = {
  slug: "closing",
  label: "Closing",
  load,
  View,
};
