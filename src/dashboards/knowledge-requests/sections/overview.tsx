import { ChartCard } from "@/components/charts/chart-card";
import { Funnel } from "@/components/charts/funnel";
import { Legend } from "@/components/charts/legend";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";

import { dailyChart, dailyTable } from "../chart-props";
import { WaitingCard } from "../charts/waiting";
import type { DataKey } from "../config";
import { krContext, loadRequests, loadTracking } from "../data";
import { share, trackedSince, type Filters, type Period } from "../filters";
import { closingSummary, formatDuration, funnelCounts, type FunnelCounts } from "../lifecycle";
import { overviewSentence, plural, trackingNote, waitingSentence } from "../sentences";
import { dailyRequests, type DailyRequests } from "../series";
import { isTracked, missing, startedInPeriod } from "../tracking";
import { MediansNote, PeriodNote, RequestsNote, WhoIsCounted, spanLabel } from "./notes";

interface OverviewData {
  period: Period;
  filters: Filters;
  /** Null while request ids aren't tracked. */
  sent: number | null;
  answered: { requests: number; answered: number } | null;
  closing: { requests: number; resolved: number; medianToResolve: number | null } | null;
  funnel: { counts: FunnelCounts; steps: { answered: boolean; resolved: boolean } } | null;
  waiting: DataKey[];
  /** Events used here that first appeared inside the range. */
  note: string | null;
  /** Per counted day, by the day each request was sent. */
  daily: DailyRequests;
}

async function load(ctx: DashboardContext) {
  const kr = krContext(ctx);
  const [tracking, requests] = await Promise.all([loadTracking(ctx, kr), loadRequests(ctx, kr)]);
  const { status } = tracking;
  const { rows } = requests;
  const has = (keys: DataKey[]) => isTracked(status, keys);
  const steps = { answered: status.answered !== null, resolved: status.closed !== null };
  const closed = has(["sent", "closed"]) ? closingSummary(rows, requests.now) : null;

  return {
    data: {
      period: kr.period,
      filters: kr.filters,
      sent: has(["sent"]) ? rows.length : null,
      answered: has(["sent", "answered"])
        ? { requests: rows.length, answered: rows.filter((r) => r.answers.length > 0).length }
        : null,
      closing: closed && {
        requests: rows.length,
        resolved: closed.counts.resolved,
        medianToResolve: closed.medianToResolve,
      },
      funnel: has(["sent", "opened"]) ? { counts: funnelCounts(rows, steps.answered), steps } : null,
      waiting: missing(status, ["opened", "answered", "closed"]),
      note: trackingNote(startedInPeriod(status, kr.period, ["sent", "opened", "answered", "closed"])),
      daily: dailyRequests(kr.period.dates, rows),
    } satisfies OverviewData,
    asOf: oldest(tracking.fetchedAt, requests.fetchedAt),
  };
}

const pct = (part: number, whole: number) => {
  const value = share(part, whole);
  return value === null ? "–" : formatNumber(value, "percent");
};

function View({ data, ctx }: { data: OverviewData; ctx: DashboardContext }) {
  const { period, filters, sent, answered, closing, funnel, waiting } = data;

  if (sent === null || !funnel) {
    const keys: DataKey[] = sent === null ? ["sent"] : ["opened"];
    return (
      <SectionFrame sentence={waitingSentence(keys)} howMeasured={<RequestsNote />}>
        <WaitingCard className="lg:col-span-6" title="Where requests stall" keys={keys}>
          Every number on this dashboard follows a request by its id, from sending to closing.
        </WaitingCard>
      </SectionFrame>
    );
  }

  const { counts, steps } = funnel;
  const funnelSteps = [
    { label: "Sent", count: counts.sent },
    { label: "Opened by an assignee", count: counts.opened },
    ...(steps.answered ? [{ label: "Also answered", count: counts.answered }] : []),
    ...(steps.resolved ? [{ label: "Also resolved", count: counts.resolved }] : []),
  ];
  const skipped = [
    steps.answered && counts.answeredUnopened > 0
      ? `${plural(counts.answeredUnopened, "more was", "more were")} answered without an assignee opening ${counts.answeredUnopened === 1 ? "it" : "them"}`
      : "",
    steps.resolved && steps.answered && counts.resolvedUnanswered > 0
      ? `${plural(counts.resolvedUnanswered, "more was", "more were")} resolved without a published answer`
      : "",
  ].filter(Boolean);
  const funnelWaiting = waiting.filter((k) => k !== "opened");
  const series: LineSeries[] = [
    { key: "sent", label: "Requests sent", color: "var(--color-chart-1)", values: data.daily.sent },
    ...(steps.answered
      ? [{ key: "answered", label: "Answered", color: "var(--color-chart-2)", values: data.daily.answered }]
      : []),
    ...(steps.resolved
      ? [{ key: "resolved", label: "Resolved", color: "var(--color-chart-3)", values: data.daily.resolved }]
      : []),
  ];

  return (
    <SectionFrame
      sentence={overviewSentence({
        days: period.days,
        since: trackedSince(period),
        funnel: counts,
        steps,
        waiting: funnelWaiting,
      })}
      notes={data.note ? [data.note] : []}
      howMeasured={
        <>
          <p>
            Are requests reaching people, getting answered and getting closed? Each tab answers one part of
            that; this one shows the whole journey, so the biggest drop says which tab to read first.
          </p>
          <RequestsNote />
          <p>
            <strong>Requests sent</strong>: <code>knowledge_request_created</code>. <strong>Answered</strong>:
            at least one published answer (<code>knowledge_request_answered</code>). <strong>Resolved</strong>
            : closed by the requester with <code>outcome = resolved</code> (
            <code>knowledge_request_closed</code>). <strong>Time to resolve</strong> is the median of its{" "}
            <code>seconds_open</code>.
          </p>
          <p>
            <strong>Where requests stall</strong> follows one set of requests through every step that is
            tracked here, so each step only counts requests that reached the steps above it and never exceeds
            them. <strong>Opened</strong> is the first time any assignee, named or through a team, opened it (
            <code>knowledge_request_opened</code>); that can be the requester, when they assigned themselves
            or are in an assigned team. Requests that skipped a step, such as one answered by the requester
            before any assignee opened it, are counted under the chart. The gap step isn’t part of it: gaps
            count by the day they were detected, requests by the day they were sent. The Gaps tab shows which
            gaps became requests.
          </p>
          <MediansNote />
          <PeriodNote period={period} />
          <WhoIsCounted filters={filters} env={ctx.env} who="the person who sent each request" />
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-6 lg:grid-cols-4">
        <StatTile title="Requests sent" value={formatNumber(sent)} />
        {answered ? (
          <StatTile
            title="Answered"
            value={pct(answered.answered, answered.requests)}
            caption={`${formatNumber(answered.answered)} of ${plural(answered.requests, "request")}, at least one answer`}
          />
        ) : (
          <WaitingCard title="Answered" keys={["answered"]}>
            Share of requests with at least one answer.
          </WaitingCard>
        )}
        {closing ? (
          <StatTile
            title="Resolved"
            value={pct(closing.resolved, closing.requests)}
            caption={`${formatNumber(closing.resolved)} of ${plural(closing.requests, "request")}`}
          />
        ) : (
          <WaitingCard title="Resolved" keys={["closed"]}>
            Share of requests the requester resolved.
          </WaitingCard>
        )}
        {closing ? (
          <StatTile
            title="Time to resolve"
            value={closing.medianToResolve === null ? "–" : formatDuration(closing.medianToResolve)}
            caption={
              closing.resolved > 0
                ? `Median of ${plural(closing.resolved, "resolved request")}`
                : "No resolved requests yet"
            }
          />
        ) : (
          <WaitingCard title="Time to resolve" keys={["closed"]}>
            Median time from sending to resolving.
          </WaitingCard>
        )}
      </div>
      <ChartCard
        className="lg:col-span-6"
        title="Requests sent, answered and resolved, daily"
        subtitle={[
          "By the day each request was sent, so the days add up to the tiles",
          ...(!steps.answered || !steps.resolved
            ? ["answered and resolved appear once they are tracked"]
            : []),
        ].join(" · ")}
        legend={
          series.length > 1 ? (
            <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
          ) : undefined
        }
        table={dailyTable(period, series)}
      >
        <LineChart {...dailyChart(period, series, "Requests sent, answered and resolved per day")} />
      </ChartCard>
      <div className="lg:col-span-6">
        <Funnel
          title="Where requests stall"
          subtitle={[spanLabel(period), ...skipped].join(" · ")}
          steps={funnelSteps}
        />
      </div>
      {funnelWaiting.length > 0 && (
        <WaitingCard className="lg:col-span-6" title="The rest of the journey" keys={funnelWaiting}>
          {funnelWaiting.includes("answered") && funnelWaiting.includes("closed")
            ? "The funnel will add “answered” and “resolved” steps."
            : funnelWaiting.includes("answered")
              ? "The funnel will add an “answered” step."
              : "The funnel will add a “resolved” step."}
        </WaitingCard>
      )}
    </SectionFrame>
  );
}

export const overview: SectionModule<OverviewData> = {
  slug: "overview",
  label: "Overview",
  load,
  View,
};
