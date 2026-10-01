// Builds serialisable props for the shared chart components from KC data.

import type { ChartTable } from "@/components/charts/chart-card";
import type { LegendItem } from "@/components/charts/legend";
import type { LineChartProps, LineSeries } from "@/components/charts/line-chart";
import { formatNumber, type NumberFormat } from "@/components/charts/scale";
import { formatDayMonth, formatDayRange, mondayOf, type ISODate } from "@/lib/dates";

import type { KCContext } from "./data";
import { alignByDayIndex, runningTotals, type DayPair, type SendWindows } from "./windows";

export const COLORS = {
  before: "var(--color-chart-before)",
  after: "var(--color-chart-after)",
  one: "var(--color-chart-1)",
  two: "var(--color-chart-2)",
};

export function windowLabels(w: SendWindows) {
  return {
    before: `Before (${formatDayRange(w.before.start, w.before.end)})`,
    after: `After (${formatDayRange(w.after.start, w.after.end)})`,
  };
}

/** Running-total pairs for one metric, matched by day index. */
export function runningPairs(w: SendWindows, counts: ReadonlyMap<ISODate, number>): DayPair[] {
  return runningTotals(alignByDayIndex(w, counts));
}

export function beforeAfterChart(pairs: DayPair[], w: SendWindows, ariaLabel: string): LineChartProps {
  const labels = windowLabels(w);
  return {
    ariaLabel,
    series: [
      { key: "before", label: labels.before, color: COLORS.before, values: pairs.map((p) => p.before) },
      { key: "after", label: labels.after, color: COLORS.after, values: pairs.map((p) => p.after) },
    ],
    xLabels: pairs.map((p) => `Day ${p.day}`),
    titles: pairs.map(
      (p) => `Day ${p.day} · ${formatDayMonth(p.beforeDate)} vs ${formatDayMonth(p.afterDate)}`,
    ),
    xTickIndices: [0, 6, pairs.length - 1],
  };
}

export function beforeAfterLegend(w: SendWindows): LegendItem[] {
  const labels = windowLabels(w);
  return [
    { label: labels.before, color: COLORS.before },
    { label: labels.after, color: COLORS.after },
  ];
}

export function beforeAfterTable(pairs: DayPair[], valueLabel: string): ChartTable {
  return {
    columns: ["Day", "Before", `${valueLabel} before`, "After", `${valueLabel} after`],
    rows: pairs.map((p) => [
      p.day,
      formatDayMonth(p.beforeDate),
      p.before,
      formatDayMonth(p.afterDate),
      p.after === null ? "Not yet" : p.after,
    ]),
  };
}

/** Axis labels roughly every 4 weeks, always including the latest week. */
function weeklyTicks(count: number): number[] {
  const ticks: number[] = [];
  for (let i = count - 1; i >= 0; i -= 4) ticks.unshift(i);
  return ticks;
}

export function weekTitle(kc: KCContext, week: ISODate): string {
  return `Week of ${formatDayMonth(week)}${week === kc.weekly.partialWeek ? " (so far)" : ""}`;
}

export function weeklyMarkers(kc: KCContext) {
  return kc.markers
    .map((date) => ({ index: kc.weekly.weeks.indexOf(mondayOf(date)), label: "Email sent" }))
    .filter((m) => m.index >= 0);
}

export function weeklyChart(
  kc: KCContext,
  series: LineSeries[],
  ariaLabel: string,
  format: NumberFormat = "int",
): LineChartProps {
  const { weeks } = kc.weekly;
  return {
    ariaLabel,
    series,
    format,
    xLabels: weeks.map(formatDayMonth),
    titles: weeks.map((w) => weekTitle(kc, w)),
    xTickIndices: weeklyTicks(weeks.length),
    markers: weeklyMarkers(kc),
    partialIndex: weeks.indexOf(kc.weekly.partialWeek),
  };
}

export function weeklyTable(kc: KCContext, series: LineSeries[], format: NumberFormat = "int"): ChartTable {
  return {
    columns: ["Week of", ...series.map((s) => s.label)],
    rows: kc.weekly.weeks.map((week, i) => [
      week === kc.weekly.partialWeek ? `${formatDayMonth(week)} (so far)` : formatDayMonth(week),
      ...series.map((s) =>
        s.values[i] === null ? "" : format === "int" ? s.values[i]! : formatNumber(s.values[i]!, format),
      ),
    ]),
  };
}
