import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";

import { BarList } from "../charts/bar-list";
import { ShareBar } from "../charts/share-bar";
import { WaitingCard } from "../charts/waiting";
import { COLORS, IGNORE_DAYS, REJECT_REASONS, type DataKey } from "../config";
import { krContext, loadRequests, loadTracking } from "../data";
import { share, trackedSince, type Filters, type Period } from "../filters";
import {
  answerRateByRouting,
  formatDuration,
  rejectionSummary,
  seenSummary,
  type RejectionSummary,
  type RoutingRate,
  type SeenSummary,
} from "../lifecycle";
import { plural, routingSentence, trackingNote, waitingSentence } from "../sentences";
import { isTracked, missing, startedInPeriod } from "../tracking";
import { MediansNote, PeriodNote, RequestsNote, WhoIsCounted, spanLabel } from "./notes";

interface RoutingData {
  period: Period;
  filters: Filters;
  seen: { requests: number; summary: SeenSummary } | null;
  rejections: { summary: RejectionSummary; answersTracked: boolean } | null;
  routing: { rates: RoutingRate[] } | null;
  waiting: { seen: DataKey[]; rejections: DataKey[]; routing: DataKey[] };
  /** Data used here that first appeared inside the range. */
  note: string | null;
}

async function load(ctx: DashboardContext) {
  const kr = krContext(ctx);
  const [tracking, requests] = await Promise.all([loadTracking(ctx, kr), loadRequests(ctx, kr)]);
  const { status } = tracking;
  const { rows } = requests;
  const SEEN: DataKey[] = ["sent", "opened", "ignored"];
  const REJECTIONS: DataKey[] = ["sent", "rejected"];
  const ROUTING: DataKey[] = ["sent", "assignedTo", "answered"];

  return {
    data: {
      period: kr.period,
      filters: kr.filters,
      seen: isTracked(status, SEEN)
        ? { requests: rows.length, summary: seenSummary(rows, requests.now) }
        : null,
      rejections: isTracked(status, REJECTIONS)
        ? { summary: rejectionSummary(rows), answersTracked: status.answered !== null }
        : null,
      routing: isTracked(status, ROUTING) ? { rates: answerRateByRouting(rows) } : null,
      waiting: {
        seen: missing(status, SEEN),
        rejections: missing(status, REJECTIONS),
        routing: missing(status, ROUTING),
      },
      note: trackingNote(
        startedInPeriod(status, kr.period, [
          "sent",
          "opened",
          "ignored",
          "rejected",
          "answered",
          "assignedTo",
        ]),
      ),
    } satisfies RoutingData,
    asOf: oldest(tracking.fetchedAt, requests.fetchedAt),
  };
}

const pct = (value: number | null) => (value === null ? "–" : formatNumber(value, "percent"));

function View({ data, ctx }: { data: RoutingData; ctx: DashboardContext }) {
  const { period, filters, seen, rejections, routing, waiting } = data;
  const D = IGNORE_DAYS;

  return (
    <SectionFrame
      sentence={
        seen
          ? routingSentence({
              days: period.days,
              since: trackedSince(period),
              requests: seen.requests,
              opened: seen.summary.opened,
              medianToOpen: seen.summary.medianToOpen,
              ignored: seen.summary.ignored,
            })
          : waitingSentence(waiting.seen)
      }
      notes={data.note ? [data.note] : []}
      howMeasured={
        <>
          <p>
            <strong>Seen</strong> separates “nobody saw it” from “saw it but didn’t answer”: they have
            different fixes. If many requests go unopened, the problem is reach, so improve notifications to
            assignees. If they are opened but not answered, look at the rejection reasons.
          </p>
          <p>
            <strong>Opened</strong> is the first time any assignee opened the request, named or through a team
            (<code>knowledge_request_opened</code>, once per request). With a team, it means someone looked,
            not everyone. It can be the requester, when they assigned themselves or are in an assigned team.{" "}
            <strong>Time to open</strong> is the median of its <code>time_since_assigned_seconds</code>.{" "}
            <strong>Not opened within {D} days</strong> is <code>knowledge_request_ignored</code>, which fires
            {` ${D} `}days after sending if nobody has opened it yet; some of those are opened later. It
            doesn’t fire for a request closed or deleted first, so an unopened request without it counts as
            closed or deleted. The share counts only requests sent at least {D} days ago.
          </p>
          <p>
            <strong>Rejections</strong>: every <code>knowledge_request_rejected</code>, by its{" "}
            <code>reason</code> (optional, so some have none). A request can be rejected more than once.{" "}
            <strong>Passed on</strong> means the rejecter suggested someone else (<code>reassigned</code>);
            answered afterwards means the request got an answer after that rejection. Each reason points to a
            different fix: unclear questions call for help writing them, “doesn’t know” for better assignee
            suggestions, duplicates and answers found elsewhere for checking existing knowledge before
            sending.
          </p>
          <p>
            <strong>Teams or people</strong> compares how requests were assigned (<code>assigned_to</code> on{" "}
            <code>knowledge_request_created</code>: people, teams or both) by the share that got at least one
            answer. A team never answers itself; one of its members does. If team requests are answered less,
            people may ignore requests not addressed to them by name. It’s a hint, not proof: vaguer questions
            might go to teams.
          </p>
          <RequestsNote />
          <MediansNote />
          <PeriodNote period={period} />
          <WhoIsCounted filters={filters} env={ctx.env} who="the person who sent each request" />
        </>
      }
    >
      {seen ? (
        <>
          <div className="lg:col-span-3">
            <StatTile
              title="Time to open"
              value={seen.summary.medianToOpen === null ? "–" : formatDuration(seen.summary.medianToOpen)}
              caption={`Median over ${plural(seen.summary.opened, "opened request")}`}
            />
          </div>
          <div className="lg:col-span-3">
            <StatTile
              title={`Not opened within ${D} days`}
              value={pct(share(seen.summary.ignored, seen.summary.oldEnough))}
              caption={`${formatNumber(seen.summary.ignored)} of ${plural(seen.summary.oldEnough, "request")} sent at least ${D} days ago; ${formatNumber(seen.summary.counts.openedLate)} opened later`}
            />
          </div>
          <ShareBar
            className="lg:col-span-6"
            title="Do assignees see their requests?"
            subtitle={spanLabel(period)}
            unit="Requests"
            segments={[
              {
                key: "openedInTime",
                label: `Opened within ${D} days`,
                count: seen.summary.counts.openedInTime,
                color: COLORS.good,
              },
              {
                key: "openedLate",
                label: `Opened after ${D} days`,
                count: seen.summary.counts.openedLate,
                color: COLORS.late,
              },
              {
                key: "notOpened",
                label: "Not opened",
                count: seen.summary.counts.notOpened,
                color: COLORS.attention,
              },
              {
                key: "closedUnopened",
                label: "Closed or deleted unopened",
                count: seen.summary.counts.closedUnopened,
                color: COLORS.neutral,
              },
              {
                key: "tooRecent",
                label: `Sent in the last ${D} days, not opened yet`,
                count: seen.summary.counts.tooRecent,
                color: COLORS.pending,
              },
            ]}
          />
        </>
      ) : (
        <WaitingCard className="lg:col-span-6" title="Do assignees see their requests?" keys={waiting.seen}>
          Time to open, and how many requests nobody opened for {D} days.
        </WaitingCard>
      )}

      {rejections ? (
        <BarList
          className="lg:col-span-3"
          title="Why do assignees reject requests?"
          subtitle={[
            `${plural(rejections.summary.total, "rejection")} of ${plural(rejections.summary.requests, "request")}`,
            rejections.summary.passedOn > 0
              ? `${formatNumber(rejections.summary.passedOn)} passed on to someone else${
                  rejections.answersTracked
                    ? `, ${formatNumber(rejections.summary.passedOnAnswered)} of them answered afterwards`
                    : ""
                }`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")}
          items={
            rejections.summary.total === 0
              ? []
              : rejections.summary.byReason.map((r) => ({
                  key: r.key || "none",
                  label: r.label,
                  share: r.count / rejections.summary.total,
                  display: formatNumber(r.count),
                }))
          }
          table={{
            columns: ["Reason", "Rejections"],
            rows: rejections.summary.byReason.map((r) => [r.label, r.count]),
          }}
          empty={`No rejections. ${spanLabel(period)}.`}
        />
      ) : (
        <WaitingCard
          className="lg:col-span-3"
          title="Why do assignees reject requests?"
          keys={waiting.rejections}
        >
          Rejections by reason: {Object.values(REJECT_REASONS).join(", ").toLowerCase()}.
        </WaitingCard>
      )}

      {routing ? (
        <BarList
          className="lg:col-span-3"
          title="Do teams work as well as naming a person?"
          subtitle={`Share with at least one answer · ${spanLabel(period)}`}
          items={routing.rates.map((r) => ({
            key: r.assignedTo,
            label: r.label,
            share: r.requests > 0 ? r.answered / r.requests : 0,
            display: `${pct(share(r.answered, r.requests))} of ${formatNumber(r.requests)}`,
          }))}
          table={{
            columns: ["Assigned to", "Requests", "Answered"],
            rows: routing.rates.map((r) => [r.label, r.requests, r.answered]),
          }}
          empty="No requests."
        />
      ) : (
        <WaitingCard
          className="lg:col-span-3"
          title="Do teams work as well as naming a person?"
          keys={waiting.routing}
        >
          The share answered for requests assigned to people, to teams, or to both.
        </WaitingCard>
      )}
    </SectionFrame>
  );
}

export const routingSection: SectionModule<RoutingData> = {
  slug: "routing",
  label: "Routing",
  load,
  View,
};
