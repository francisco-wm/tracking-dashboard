// Builds serialisable props for the shared chart components from adoption data.

import type { ChartTable } from "@/components/charts/chart-card";
import type { LineChartProps, LineSeries } from "@/components/charts/line-chart";
import { formatNumber, type NumberFormat } from "@/components/charts/scale";
import { formatDayMonth, type ISODate } from "@/lib/dates";

import type { Period } from "./filters";

export const COLORS = {
  one: "var(--color-chart-1)",
  two: "var(--color-chart-2)",
  three: "var(--color-chart-3)",
};

/** About seven axis labels whatever the range, always including this week. */
export function weeklyTicks(count: number): number[] {
  const step = Math.max(1, Math.ceil(count / 7));
  const ticks: number[] = [];
  for (let i = count - 1; i >= 0; i -= step) ticks.unshift(i);
  return ticks;
}

export function weekLabel(period: Period, week: ISODate): string {
  return `Week of ${formatDayMonth(week)}${week === period.thisWeek ? " (so far)" : ""}`;
}

/** Table cell for a week: "19 Oct", or "26 Oct (so far)". */
export function weekCell(period: Period, week: ISODate): string {
  return weekLabel(period, week).replace("Week of ", "");
}

export function weeklyChart(
  period: Period,
  series: LineSeries[],
  ariaLabel: string,
  format: NumberFormat = "int",
): LineChartProps {
  const { mondays } = period;
  return {
    ariaLabel,
    series,
    format,
    xLabels: mondays.map(formatDayMonth),
    titles: mondays.map((w) => weekLabel(period, w)),
    xTickIndices: weeklyTicks(mondays.length),
    partialIndex: mondays.length - 1,
  };
}

export function weeklyTable(period: Period, series: LineSeries[], format: NumberFormat = "int"): ChartTable {
  return {
    columns: ["Week of", ...series.map((s) => s.label)],
    rows: period.mondays.map((week, i) => [
      weekCell(period, week),
      ...series.map((s) => {
        const value = s.values[i];
        if (value === null) return s.emptyLabel ?? "";
        return format === "int" ? Math.round(value) : formatNumber(value, format);
      }),
    ]),
  };
}
