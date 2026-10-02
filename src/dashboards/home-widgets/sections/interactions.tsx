import { ChartCard } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { LineChart } from "@/components/charts/line-chart";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";

import { dailyChart, dailyTable, widgetSeries } from "../chart-props";
import { actionLabel, WIDGETS, widgetLabel } from "../config";
import {
  hwContext,
  loadClicksByAction,
  loadClicksByWidget,
  loadClicksDaily,
  loadHomeTotals,
  type ActionClicks,
  type WidgetClicks,
} from "../data";
import { share, type Filters, type Period } from "../filters";
import { interactionsSentence, plural } from "../sentences";
import { byWidgetOrder } from "../series";
import { HomePageNote, PeriodNote, TimelineNote, WhoIsCounted } from "./notes";
import { WidgetTable } from "./widget-table";

interface InteractionsData {
  period: Period;
  filters: Filters;
  homePeople: number;
  clickers: number;
  clicks: number;
  byWidget: WidgetClicks[];
  byAction: ActionClicks[];
  daily: Record<string, number[]>;
}

async function load(ctx: DashboardContext) {
  const hw = hwContext(ctx);
  const [home, byWidget, byAction, daily] = await Promise.all([
    loadHomeTotals(ctx, hw),
    loadClicksByWidget(ctx, hw),
    loadClicksByAction(ctx, hw),
    loadClicksDaily(ctx, hw),
  ]);
  return {
    data: {
      period: hw.period,
      filters: hw.filters,
      homePeople: home.homePeople,
      clickers: home.clickers,
      clicks: home.clicks,
      byWidget: byWidget.rows,
      byAction: byAction.rows,
      daily: daily.byWidget,
    },
    asOf: oldest(home.fetchedAt, byWidget.fetchedAt, byAction.fetchedAt, daily.fetchedAt),
  };
}

function View({ data, ctx }: { data: InteractionsData; ctx: DashboardContext }) {
  const { period, filters, homePeople, clickers, clicks, byWidget, byAction, daily } = data;
  const series = widgetSeries(daily);
  const counts = (id: string) =>
    byWidget.find((w) => w.widget === id) ?? { widget: id, clicks: 0, people: 0 };

  return (
    <SectionFrame
      sentence={interactionsSentence({
        days: period.days,
        homePeople,
        clickers,
        clicks,
        widgets: byWidget.map((w) => ({ label: widgetLabel(w.widget), clicks: w.clicks })),
      })}
      howMeasured={
        <>
          <p>
            <strong>Clicks</strong> count every click on an item in a widget (
            <code>dashboard_widget_clicked</code>). <strong>Opened an item</strong> is <code>open_item</code>;{" "}
            <strong>Started a new draft</strong> is <code>create_fragment_draft</code>, only offered in Recent
            fragment drafts. <strong>People</strong> counts each person once per widget, however often they
            clicked.
          </p>
          <p>
            <strong>Share of home-page visitors</strong> is the people who clicked a widget divided by the
            people who opened the home page in the period.
          </p>
          <HomePageNote />
          <PeriodNote days={period.days} />
          <TimelineNote env={ctx.env} />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      {WIDGETS.map((w) => {
        const { clicks: widgetClicks, people } = counts(w.id);
        const reach = share(people, homePeople);
        return (
          <div key={w.id} className="lg:col-span-2">
            <StatTile
              title={w.label}
              value={plural(widgetClicks, "click")}
              caption={
                reach === null
                  ? `From ${plural(people, "person", "people")}`
                  : `From ${plural(people, "person", "people")}, ${formatNumber(reach, "percent")} of home-page visitors`
              }
            />
          </div>
        );
      })}
      <ChartCard
        className="lg:col-span-6"
        title="Clicks per widget, daily"
        subtitle="Every click on a widget item"
        legend={<Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
        table={dailyTable(period, series)}
      >
        <LineChart {...dailyChart(period, ctx.env, series, "Clicks per widget per day")} />
      </ChartCard>
      <WidgetTable
        className="lg:col-span-6"
        title="Clicks by widget and action"
        subtitle="Someone who did both actions counts once under each"
        columns={["Widget", "Action", "Clicks", "People"]}
        labelColumns={2}
        rows={byWidgetOrder(byAction, (r) => r.clicks).map((r) => [
          widgetLabel(r.widget),
          actionLabel(r.action),
          formatNumber(r.clicks),
          formatNumber(r.people),
        ])}
        empty="No widget clicks in this period."
      />
    </SectionFrame>
  );
}

export const interactions: SectionModule<InteractionsData> = {
  slug: "interactions",
  label: "Interactions",
  load,
  View,
};
