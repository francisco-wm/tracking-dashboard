import { ChartCard } from "@/components/charts/chart-card";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";

import { COLORS, dailyChart, dayLabel } from "../chart-props";
import { COMPLETION_WINDOW_DAYS } from "../config";
import { feContext, loadCompletionDaily, loadCompletionTotals, type CompletionDay } from "../data";
import { completionRate, type Filters, type Period } from "../filters";
import { completionSentence, plural } from "../sentences";
import { PeriodNote, TimelineNote, WhoIsCounted } from "./notes";

interface CompletionData {
  period: Period;
  filters: Filters;
  started: number;
  listed: number;
  stillOpen: number;
  days: CompletionDay[];
}

async function load(ctx: DashboardContext) {
  const fe = feContext(ctx);
  const [totals, daily] = await Promise.all([loadCompletionTotals(ctx, fe), loadCompletionDaily(ctx, fe)]);
  return {
    data: {
      period: fe.period,
      filters: fe.filters,
      started: totals.started,
      listed: totals.listed,
      stillOpen: totals.stillOpen,
      days: daily.days,
    },
    asOf: oldest(totals.fetchedAt, daily.fetchedAt),
  };
}

const NO_EDITS = "No edits started";

function View({ data, ctx }: { data: CompletionData; ctx: DashboardContext }) {
  const { period, filters, started, listed, stillOpen, days } = data;
  const rate = completionRate(listed, started);
  const W = COMPLETION_WINDOW_DAYS;

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
      sentence={completionSentence({ days: period.days, started, listed, stillOpen })}
      howMeasured={
        <>
          <p>
            <strong>Edit completion rate</strong> follows each fragment someone started editing in the period
            (<code>knowledge_piece_edit_started</code>) and counts it as completed when the changes were
            listed (<code>knowledge_piece_republished</code> for the same fragment) within {W} days of
            starting. Each fragment counts once. This is the same funnel as in PostHog: per fragment, {W}-day
            window.
          </p>
          <p>
            <strong>Still open</strong> fragments were started in the last {W} days and aren’t listed yet.
            They can still be completed, so recent numbers read low until their {W} days are up.
          </p>
          <p>
            The <strong>daily</strong> rate groups fragments by the day the edit started; a fragment edited on
            two different days counts on both. Days without any started edit have no rate. With only a few
            edits a day, single days swing between 0% and 100%; the headline rate is the steadier number.
            Re-listings with no tracked edit start are not part of the rate.
          </p>
          <PeriodNote days={period.days} />
          <TimelineNote />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <div className="lg:col-span-3">
        <StatTile
          title="Edit completion rate"
          value={rate === null ? "–" : formatNumber(rate, "percent")}
          caption={`${formatNumber(listed)} of ${plural(started, "edited fragment")} listed within ${W} days`}
        />
      </div>
      <div className="lg:col-span-3">
        <StatTile
          title="Still open"
          value={formatNumber(stillOpen)}
          caption={`Started in the last ${W} days and not listed yet; these can still be completed`}
        />
      </div>
      <ChartCard
        className="lg:col-span-6"
        title="Edit completion rate, daily"
        subtitle="By the day the edit started; recent days read low while edits are still open"
        table={{
          columns: ["Day", "Fragments edited", `Listed within ${W} days`, "Completion rate"],
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
