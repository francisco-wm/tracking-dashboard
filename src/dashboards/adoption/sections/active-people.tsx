import { ChartCard } from "@/components/charts/chart-card";
import { Legend } from "@/components/charts/legend";
import { LifecycleChart } from "@/components/charts/lifecycle-chart";
import { DROPPED_OFF, LIFECYCLE_SEGMENTS } from "@/components/charts/lifecycle-segments";
import type { LineSeries } from "@/components/charts/line-chart";
import { formatNumber } from "@/components/charts/scale";
import { StatTile } from "@/components/charts/stat-compare";
import { SectionFrame } from "@/components/shell/section-frame";
import { oldest, type DashboardContext, type SectionModule } from "@/dashboards/types";
import { addDays, formatDayMonth } from "@/lib/dates";

import { COLORS, weekCell, weekLabel, weeklyTicks } from "../chart-props";
import { AVERAGE_WEEKS } from "../config";
import { adContext, loadLifecycle, loadTotals, loadWeeklyPeople, type LifecycleWeek } from "../data";
import { trailingAverage, weekIndex, type Filters, type Period } from "../filters";
import { activeSentence, changePhrase } from "../sentences";
import { ActiveChart } from "./active-chart";
import { ActiveNote, WeeksNote, WhoIsCounted } from "./notes";

interface ActivePeopleData {
  period: Period;
  filters: Filters;
  /** Unique people active in any week of the period. */
  totalActive: number;
  /** Active people per week, oldest first. */
  active: number[];
  lifecycle: LifecycleWeek[];
}

async function load(ctx: DashboardContext) {
  const ad = adContext(ctx);
  const [totals, weekly, lifecycle] = await Promise.all([
    loadTotals(ctx, ad),
    loadWeeklyPeople(ctx, ad),
    loadLifecycle(ctx, ad),
  ]);
  return {
    data: {
      period: ad.period,
      filters: ad.filters,
      totalActive: totals.active,
      active: weekly.weeks.map((w) => w.active),
      lifecycle: lifecycle.weeks,
    },
    asOf: oldest(totals.fetchedAt, weekly.fetchedAt, lifecycle.fetchedAt),
  };
}

function View({ data, ctx }: { data: ActivePeopleData; ctx: DashboardContext }) {
  const { period, filters, totalActive, active, lifecycle } = data;
  const last = weekIndex(period, period.lastWeek);
  const lastWeek = active[last];
  const fourWeeksBefore = active[weekIndex(period, addDays(period.lastWeek, -28))] ?? 0;
  const thisWeek = active[active.length - 1];

  const activeSeries: LineSeries = {
    key: "active",
    label: "Active people",
    color: COLORS.one,
    values: active,
  };
  const averageSeries: LineSeries = {
    key: "average",
    label: `${AVERAGE_WEEKS}-week average`,
    color: COLORS.two,
    values: trailingAverage(active, AVERAGE_WEEKS),
    emptyLabel: `Needs ${AVERAGE_WEEKS} full weeks`,
  };

  return (
    <SectionFrame
      sentence={activeSentence({ week: period.lastWeek, active: lastWeek, fourWeeksBefore })}
      howMeasured={
        <>
          <ActiveNote />
          <p>
            <strong>Weekly active people</strong> counts each person once per week, however often they came
            in. <strong>Active in the last {period.weeks} weeks</strong> counts each person once across all of
            them, so it is more than any single week.
          </p>
          <p>
            The <strong>{AVERAGE_WEEKS}-week average</strong> is the mean of that week and the{" "}
            {AVERAGE_WEEKS - 1} before it ({AVERAGE_WEEKS * 7} days), which smooths out busy and quiet weeks.
            It starts once {AVERAGE_WEEKS} full weeks exist and leaves out this week, which isn’t over yet.
          </p>
          <p>
            Each week, every active person is one of: <strong>new</strong> (their first active week ever),{" "}
            <strong>returning</strong> (active this week and last week) or{" "}
            <strong>came back after a break</strong> (active this week, not last week, and not new).{" "}
            <strong>Dropped off</strong> counts people active last week but not this week, shown below the
            line. This week’s “dropped off” includes people who simply haven’t come in yet.
          </p>
          <WeeksNote period={period} />
          <WhoIsCounted filters={filters} env={ctx.env} />
        </>
      }
    >
      <div className="grid gap-4 lg:col-span-6 lg:grid-cols-3">
        <StatTile
          title="Active people last week"
          value={formatNumber(lastWeek)}
          caption={`Week of ${formatDayMonth(period.lastWeek)} · ${changePhrase(lastWeek, fourWeeksBefore)}`}
        />
        <StatTile
          title="This week so far"
          value={formatNumber(thisWeek)}
          caption={`Week of ${formatDayMonth(period.thisWeek)}, still in progress`}
        />
        <StatTile
          title={`Active in the last ${period.weeks} weeks`}
          value={formatNumber(totalActive)}
          caption="Each person once, active in at least one of those weeks"
        />
      </div>
      <ActiveChart period={period} active={activeSeries} average={averageSeries} />
      <ChartCard
        className="lg:col-span-6"
        title="Who was active: weekly lifecycle"
        subtitle="Active people each week by type; dropped off below the line"
        legend={
          <Legend
            items={[
              ...[...LIFECYCLE_SEGMENTS]
                .reverse()
                .map((s) => ({ label: s.label, color: s.color, shape: "rect" as const })),
              { label: DROPPED_OFF.label, color: DROPPED_OFF.color, shape: "rect" },
            ]}
          />
        }
        table={{
          columns: ["Week of", "Came back after a break", "New", "Returning", "Dropped off"],
          rows: lifecycle.map((w) => [
            weekCell(period, w.week),
            w.cameBack,
            w.newPeople,
            w.returning,
            w.droppedOff,
          ]),
        }}
      >
        <LifecycleChart
          ariaLabel="Weekly lifecycle of active people"
          bars={lifecycle.map((w) => ({
            label: formatDayMonth(w.week),
            title: weekLabel(period, w.week),
            returning: w.returning,
            newPeople: w.newPeople,
            cameBack: w.cameBack,
            droppedOff: w.droppedOff,
          }))}
          xTickIndices={weeklyTicks(lifecycle.length)}
          partialIndex={lifecycle.length - 1}
        />
      </ChartCard>
    </SectionFrame>
  );
}

export const activePeople: SectionModule<ActivePeopleData> = {
  slug: "active-people",
  label: "Active people",
  load,
  View,
};
