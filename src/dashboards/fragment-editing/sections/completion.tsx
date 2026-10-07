import { ChartCard } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";

import { COLORS, dailyChart, dailyTable, dayLabel } from "../chart-props";
import { COMPLETION_WINDOW_DAYS } from "../config";
import {
  feContext,
  loadCompletionDaily,
  loadCompletionTotals,
  loadListingTotals,
  type CompletionDay,
} from "../data";
import { completionRate, type Filters, type Period } from "../filters";
import { completionSentence, plural } from "../sentences";
import { PeriodNote, TimelineNote, WhoIsCounted } from "./notes";

interface CompletionData {
  period: Period;
  filters: Filters;
  /** Per edit, not per fragment: a fragment edited twice counts twice. */
  started: number;
  /** Distinct fragments behind `started`. */
  fragments: number;
  listed: number;
  stillInDraft: number;
  relists: number;
  relistedFragments: number;
  days: CompletionDay[];
}

async function load(ctx: DashboardContext) {
  const fe = feContext(ctx);
  // Listing totals are the Edits listed tab's query, so this reuses its cached result.
  const [totals, daily, listings] = await Promise.all([
    loadCompletionTotals(ctx, fe),
    loadCompletionDaily(ctx, fe),
    loadListingTotals(ctx, fe),
  ]);
  return {
    data: {
      period: fe.period,
      filters: fe.filters,
      started: totals.started,
      fragments: totals.fragments,
      listed: totals.listed,
      stillInDraft: totals.stillInDraft,
      relists: listings.relists,
      relistedFragments: listings.relistedFragments,
      days: daily.days,
    },
    asOf: oldest(totals.fetchedAt, daily.fetchedAt, listings.fetchedAt),
  };
}

const NO_EDITS = "No edits started";

function View({ data, ctx }: { data: CompletionData; ctx: DashboardContext }) {
  const { period, filters, started, fragments, listed, stillInDraft, relists, relistedFragments, days } =
    data;
  const rate = completionRate(listed, started);
  const W = COMPLETION_WINDOW_DAYS;

  const counts: LineSeries[] = [
    { key: "started", label: "Edits started", color: COLORS.one, values: days.map((d) => d.started) },
    { key: "listed", label: `Listed within ${W} days`, color: COLORS.two, values: days.map((d) => d.listed) },
  ];
  const series: LineSeries[] = [
    {
      key: "rate",
      label: "Edit completion rate",
      color: COLORS.one,
      values: days.map((d) => completionRate(d.listed, d.started)),
      emptyLabel: NO_EDITS,
    },
  ];

  return (
    <SectionFrame
      sentence={completionSentence({ days: period.days, started, listed, stillInDraft })}
      howMeasured={
        <>
          <p>
            Everything here counts <strong>edits</strong>, not fragments: every edit start (
            <code>knowledge_piece_edit_started</code>) in the period is one edit, so a fragment edited twice
            counts twice. The fragment counts under the first two numbers count each fragment once.
          </p>
          <p>
            <strong>Edit completion rate</strong> is the share of edits started that reached the listed state:
            a re-listing of the same fragment (<code>knowledge_piece_republished</code>) within {W} days of
            the edit starting and before that fragment’s next edit started, so one re-listing never completes
            two edits. PostHog’s funnel counts fragments instead, so its rate can differ.
          </p>
          <p>
            <strong>Re-listed</strong> counts every re-listing in the period, including one whose edit started
            before it, so it can be slightly higher than the edits the rate counts as listed.
          </p>
          <p>
            <strong>Still in draft</strong> edits were started in the last {W} days, aren’t listed yet and are
            the fragment’s newest edit. They can still be listed, so recent numbers read low until their {W}{" "}
            days are up. An older unlisted edit counts as not listed.
          </p>
          <p>
            The <strong>daily</strong> charts group edits by the day they started.{" "}
            <strong>Edits started vs listed</strong> shows the counts behind each day’s rate: edits started
            that day, and how many of those were listed within {W} days, whenever that listing happened. Days
            without any started edit have no rate. With only a few edits a day, single days swing between 0%
            and 100%; the headline rate is the steadier number. Re-listings with no tracked edit start are not
            part of either chart.
          </p>
          <PeriodNote days={period.days} />
          <TimelineNote />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-6 lg:grid-cols-4">
        <StatTile
          title="Edits started"
          value={formatNumber(started)}
          caption={`On ${plural(fragments, "fragment")}`}
        />
        <StatTile
          title="Re-listed"
          value={formatNumber(relists)}
          caption={`On ${plural(relistedFragments, "fragment")}`}
        />
        <StatTile
          title="Edit completion rate"
          value={rate === null ? "–" : formatNumber(rate, "percent")}
          caption={`${formatNumber(listed)} of ${plural(started, "edit")} listed within ${W} days`}
        />
        <StatTile
          title="Still in draft"
          value={formatNumber(stillInDraft)}
          caption={`Started in the last ${W} days and not listed yet; these can still be listed`}
        />
      </div>
      <ChartCard
        className="lg:col-span-6"
        title="Edits started vs listed, daily"
        subtitle={`Edits started each day, and how many of those were listed within ${W} days`}
        legend={<Legend items={counts.map((s) => ({ label: s.label, color: s.color }))} />}
        table={dailyTable(period, counts)}
      >
        <LineChart {...dailyChart(period, counts, "Edits started and listed per day")} />
      </ChartCard>
      <ChartCard
        className="lg:col-span-6"
        title="Edit completion rate, daily"
        subtitle="By the day the edit started; recent days read low while edits are still in draft"
        table={{
          columns: ["Day", "Edits started", `Listed within ${W} days`, "Completion rate"],
          rows: days.map((d) => {
            const dayRate = completionRate(d.listed, d.started);
            return [
              dayLabel(period, d.date),
              d.started,
              d.listed,
              dayRate === null ? NO_EDITS : formatNumber(dayRate, "percent"),
            ];
          }),
        }}
      >
        <LineChart {...dailyChart(period, series, "Edit completion rate per day", "percent")} />
      </ChartCard>
    </SectionFrame>
  );
}

export const completion: SectionModule<CompletionData> = {
  slug: "completion",
  label: "Completion rate",
  load,
  View,
};
