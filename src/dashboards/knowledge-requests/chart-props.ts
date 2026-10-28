// Builds serialisable props for the shared chart components from knowledge-request data.

import type { ChartTable } from "@/components/charts/chart-card";
import type { LineChartProps, LineSeries } from "@/components/charts/line-chart";
import { formatDayMonth, type ISODate } from "@/lib/dates";

import type { Period } from "./filters";

/** About seven axis labels whatever the range, always including today. */
function dailyTicks(count: number): number[] {
  const step = Math.max(1, Math.ceil(count / 7));
  const ticks: number[] = [];
  for (let i = count - 1; i >= 0; i -= step) ticks.unshift(i);
  return ticks;
}

function dayLabel(period: Period, date: ISODate): string {
  return `${formatDayMonth(date)}${date === period.end ? " (so far)" : ""}`;
}

/** A daily line chart over the counted days; today is still in progress, so it is drawn lighter. */
export function dailyChart(period: Period, series: LineSeries[], ariaLabel: string): LineChartProps {
  const { dates } = period;
  return {
    ariaLabel,
    series,
    xLabels: dates.map(formatDayMonth),
    titles: dates.map((d) => dayLabel(period, d)),
    xTickIndices: dailyTicks(dates.length),
    partialIndex: dates.length - 1,
  };
}

export function dailyTable(period: Period, series: LineSeries[]): ChartTable {
  return {
    columns: ["Day", ...series.map((s) => s.label)],
    rows: period.dates.map((date, i) => [dayLabel(period, date), ...series.map((s) => s.values[i] ?? 0)]),
  };
}
