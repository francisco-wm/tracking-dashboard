import { ChartCard } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";
import { formatDayMonth } from "@/lib/dates";

import { dailyChart, dailyTable } from "../chart-props";
import { ShareBar } from "../charts/share-bar";
import { WaitingCard } from "../charts/waiting";
import { COLORS } from "../config";
import { krContext, loadGaps, loadTracking } from "../data";
import { share, trackedSince, type Filters, type Period } from "../filters";
import { gapsSentence, plural, trackingNote } from "../sentences";
import { dailyGaps, type DailyGaps } from "../series";
import { isTracked, startedInPeriod, type TrackingStart } from "../tracking";
import { PeriodNote, WhoIsCounted } from "./notes";

interface GapsData {
  period: Period;
  filters: Filters;
  /** Every gap in the period, linked or not. */
  detected: number;
  /** Null while gaps don't carry their request's id. `since`: set when that started inside the range. */
  linked: { gaps: number; sent: number; since: TrackingStart | null } | null;
  /** Per counted day, by the day each gap was detected. */
  daily: DailyGaps;
}

async function load(ctx: DashboardContext) {
  const kr = krContext(ctx);
  const [tracking, gaps] = await Promise.all([loadTracking(ctx, kr), loadGaps(ctx, kr)]);
  const { status } = tracking;
  return {
    data: {
      period: kr.period,
      filters: kr.filters,
      detected: gaps.detected,
      linked: isTracked(status, ["gapLink"])
        ? {
            gaps: gaps.linked,
            sent: gaps.sent,
            since: startedInPeriod(status, kr.period, ["gapLink"])[0] ?? null,
          }
        : null,
      daily: dailyGaps(kr.period.dates, gaps.days),
    } satisfies GapsData,
    asOf: oldest(tracking.fetchedAt, gaps.fetchedAt),
  };
}

function View({ data, ctx }: { data: GapsData; ctx: DashboardContext }) {
  const { period, filters, detected, linked } = data;
  const rate = linked && share(linked.sent, linked.gaps);
  const unmatched = linked ? Math.max(0, detected - linked.gaps) : 0;
  const before = linked?.since ? `before ${formatDayMonth(linked.since.date)}` : "";
  const note = linked ? trackingNote(linked.since ? [linked.since] : []) : null;
  const since = trackedSince(period);
  const detectedSpan = since ? `Since ${formatDayMonth(since)}` : `Last ${period.days} days`;
  const series: LineSeries[] = [
    {
      key: "detected",
      label: "Gaps detected",
      color: "var(--color-chart-before)",
      values: data.daily.detected,
    },
    ...(linked
      ? [{ key: "sent", label: "Sent as a request", color: "var(--color-chart-1)", values: data.daily.sent }]
      : []),
  ];

  return (
    <SectionFrame
      sentence={gapsSentence({
        days: period.days,
        since: trackedSince(period),
        detected,
        linked: linked?.gaps ?? 0,
        sent: linked?.sent ?? 0,
        tracked: linked !== null,
        linkedSince: linked?.since?.date ?? null,
      })}
      notes={note ? [note] : []}
      howMeasured={
        <>
          <p>
            Requests can only start from a gap the AI detects in a chat, so this is the whole top of the
            funnel. If few gaps become requests, the AI flags things people don’t care about, or at the wrong
            moment: tune detection. If most do, it’s worth letting people start a request without a chat.
          </p>
          <p>
            <strong>Gaps detected</strong>: <code>knowledge_gap_detected</code>, which fires when the AI
            drafts a request in a normal or getting-started chat; nobody is assigned yet. Each gap counts
            once, by the day it was detected. <strong>Sent as a request</strong>: the same request was sent
            later (<code>knowledge_request_created</code>, its first assignment), matched on{" "}
            <code>knowledge_request_uuid</code>, at any time up to today. A gap from the last few days can
            still be sent, so the share for recent days can rise. <strong>Can’t be matched</strong>: gaps
            detected before the project sent the request id with them; whether they were sent is unknown, so
            the share only counts gaps that can be matched.
          </p>
          <PeriodNote period={period} />
          <WhoIsCounted filters={filters} env={ctx.env} who="the person whose chat raised the gap" />
        </>
      }
    >
      {linked ? (
        <>
          <div className="lg:col-span-2">
            <StatTile
              title="Gaps detected"
              value={formatNumber(detected)}
              caption={
                unmatched > 0
                  ? `${detectedSpan}; ${formatNumber(unmatched)} ${before || "older"} can’t be matched to a request`
                  : detectedSpan
              }
            />
          </div>
          <div className="lg:col-span-2">
            <StatTile
              title="Sent as a request"
              value={rate === null || rate === undefined ? "–" : formatNumber(rate, "percent")}
              caption={`${formatNumber(linked.sent)} of the ${plural(linked.gaps, "gap")} that can be matched`}
            />
          </div>
          <div className="lg:col-span-2">
            <StatTile
              title="Never sent"
              value={formatNumber(linked.gaps - linked.sent)}
              caption="Drafts nobody assigned; recent ones may still be sent"
            />
          </div>
          <ShareBar
            className="lg:col-span-6"
            title="Do detected gaps turn into requests?"
            subtitle={
              since ? `Detected since ${formatDayMonth(since)}` : `Detected in the last ${period.days} days`
            }
            unit="Gaps"
            segments={[
              { key: "sent", label: "Sent as a request", count: linked.sent, color: COLORS.good },
              { key: "unsent", label: "Not sent", count: linked.gaps - linked.sent, color: COLORS.neutral },
              ...(unmatched > 0
                ? [
                    {
                      key: "unmatched",
                      label: before ? `Detected ${before}, can’t be matched` : "Can’t be matched",
                      count: unmatched,
                      color: COLORS.pending,
                    },
                  ]
                : []),
            ]}
          />
        </>
      ) : (
        <>
          <div className="lg:col-span-2">
            <StatTile title="Gaps detected" value={formatNumber(detected)} caption={detectedSpan} />
          </div>
          <WaitingCard
            className="lg:col-span-4"
            title="Do detected gaps turn into requests?"
            keys={["gapLink"]}
          >
            With it, each gap can be matched to the request it became, to show the share of gaps that were
            sent.
          </WaitingCard>
        </>
      )}
      <ChartCard
        className="lg:col-span-6"
        title={linked ? "Gaps detected and sent as a request, daily" : "Gaps detected, daily"}
        subtitle={
          linked
            ? "By the day each gap was detected, so the days add up to the tiles"
            : "Sent as a request appears once gaps carry their request id"
        }
        legend={
          series.length > 1 ? (
            <Legend items={series.map((x) => ({ label: x.label, color: x.color }))} />
          ) : undefined
        }
        table={dailyTable(period, series)}
      >
        <LineChart {...dailyChart(period, series, "Gaps detected and sent as a request per day")} />
      </ChartCard>
    </SectionFrame>
  );
}

export const gaps: SectionModule<GapsData> = {
  slug: "gaps",
  label: "Gaps",
  load,
  View,
};
