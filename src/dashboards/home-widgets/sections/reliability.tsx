import { ChartCard } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { LineChart } from "@/components/charts/line-chart";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";

import { dailyChart, dailyTable, widgetSeries } from "../chart-props";
import { RETRY_SECONDS, WIDGETS, widgetLabel } from "../config";
import {
  hwContext,
  loadFailuresDaily,
  loadHomeTotals,
  loadReliability,
  type WidgetReliability,
} from "../data";
import { share, trackedSince, type Filters, type Period } from "../filters";
import { plural, reliabilitySentence } from "../sentences";
import { byWidgetOrder } from "../series";
import { HomePageNote, PeriodNote, TimelineNote, WhoIsCounted } from "./notes";
import { WidgetTable } from "./widget-table";

interface ReliabilityData {
  period: Period;
  filters: Filters;
  homeViews: number;
  homePeople: number;
  /** People who saw any widget fail. */
  failedPeople: number;
  rows: WidgetReliability[];
  daily: Record<string, (number | null)[]>;
}

async function load(ctx: DashboardContext) {
  const hw = hwContext(ctx);
  const [home, reliability, daily] = await Promise.all([
    loadHomeTotals(ctx, hw),
    loadReliability(ctx, hw),
    loadFailuresDaily(ctx, hw),
  ]);
  return {
    data: {
      period: hw.period,
      filters: hw.filters,
      homeViews: home.homeViews,
      homePeople: home.homePeople,
      failedPeople: home.failedPeople,
      rows: reliability.rows,
      daily: daily.byWidget,
    },
    asOf: oldest(home.fetchedAt, reliability.fetchedAt, daily.fetchedAt),
  };
}

const pct = (value: number | null) => (value === null ? "–" : formatNumber(value, "percent"));

function View({ data, ctx }: { data: ReliabilityData; ctx: DashboardContext }) {
  const { period, filters, homeViews, homePeople, failedPeople, rows, daily } = data;
  const failures = rows.reduce((sum, r) => sum + r.failures, 0);
  const retries = rows.reduce((sum, r) => sum + r.retries, 0);
  const retriesWorked = rows.reduce((sum, r) => sum + r.retriesWorked, 0);
  const series = widgetSeries(daily);

  // Every known widget gets a row, so "0 failed loads" is visible rather than missing.
  const tableRows = byWidgetOrder(
    [
      ...WIDGETS.filter((w) => !rows.some((r) => r.widget === w.id)).map((w) => ({
        widget: w.id,
        failures: 0,
        people: 0,
        retries: 0,
        retriesWorked: 0,
      })),
      ...rows,
    ],
    (r) => r.failures,
  );

  return (
    <SectionFrame
      sentence={reliabilitySentence({
        days: period.days,
        since: trackedSince(period),
        failures,
        people: failedPeople,
        retries,
        retriesWorked,
      })}
      howMeasured={
        <>
          <p>
            <strong>Failed loads</strong> count every time a widget couldn’t load its items (
            <code>dashboard_widget_fetch_failed</code>). <strong>People affected</strong> saw at least one
            failure.
          </p>
          <p>
            <strong>Failed share of home-page views</strong> divides a widget’s failed loads by home-page
            views. Every view loads every widget once, but a retry loads it again, so this is close to, not
            exactly, the share of loads that failed. There is no event for a successful load.
          </p>
          <p>
            <strong>Retries</strong> count clicks on the button to load a widget again (
            <code>dashboard_widget_retry_clicked</code>). A retry <strong>worked</strong> when the same
            person’s widget didn’t fail again within {RETRY_SECONDS} seconds.
          </p>
          <HomePageNote />
          <PeriodNote period={period} />
          <TimelineNote />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <div className="lg:col-span-2">
        <StatTile
          title="Failed loads"
          value={formatNumber(failures)}
          caption={`${pct(share(failures, homeViews))} of ${plural(homeViews, "home-page view")}, across all widgets`}
        />
      </div>
      <div className="lg:col-span-2">
        <StatTile
          title="People affected"
          value={formatNumber(failedPeople)}
          caption={`Of ${plural(homePeople, "home-page visitor")}`}
        />
      </div>
      <div className="lg:col-span-2">
        <StatTile
          title="Retries that worked"
          value={pct(share(retriesWorked, retries))}
          caption={
            retries === 0
              ? "Nobody retried"
              : `${formatNumber(retriesWorked)} of ${plural(retries, "retry", "retries")}`
          }
        />
      </div>
      <ChartCard
        className="lg:col-span-6"
        title="Failed loads per widget, daily"
        subtitle="Each time a widget couldn’t load its items"
        legend={<Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
        table={dailyTable(period, series)}
      >
        <LineChart {...dailyChart(period, series, "Failed loads per widget per day")} />
      </ChartCard>
      <WidgetTable
        className="lg:col-span-6"
        title="Failures and retries by widget"
        columns={[
          "Widget",
          "Failed loads",
          "People affected",
          "Failed share of home-page views",
          "Retries",
          "Retries that worked",
        ]}
        rows={tableRows.map((r) => [
          widgetLabel(r.widget),
          formatNumber(r.failures),
          formatNumber(r.people),
          pct(share(r.failures, homeViews)),
          formatNumber(r.retries),
          formatNumber(r.retriesWorked),
        ])}
        empty="No widgets yet."
      />
    </SectionFrame>
  );
}

export const reliability: SectionModule<ReliabilityData> = {
  slug: "reliability",
  label: "Reliability",
  load,
  View,
};
