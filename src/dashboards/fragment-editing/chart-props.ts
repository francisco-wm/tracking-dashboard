// Builds serialisable props for the shared chart components from FE data.

import type { ChartTable } from "@/components/charts/chart-card";
import type { ChartMarker, LineChartProps, LineSeries } from "@/components/charts/line-chart";
import { formatNumber, type NumberFormat } from "@/components/charts/scale";
import { formatDayMonth, type ISODate } from "@/lib/dates";

import { EDITING_PUBLIC } from "./config";
import { dayIndex, type Period } from "./filters";

export const COLORS = {
  one: "var(--color-chart-1)",
  two: "var(--color-chart-2)",
};

/** About seven axis labels whatever the range, always including today. */
function dailyTicks(count: number): number[] {
  const step = Math.max(1, Math.ceil(count / 7));
  const ticks: number[] = [];
  for (let i = count - 1; i >= 0; i -= step) ticks.unshift(i);
  return ticks;
}

export function dayLabel(period: Period, date: ISODate): string {
  return `${formatDayMonth(date)}${date === period.end ? " (so far)" : ""}`;
}

export function editingPublicMarkers(period: Period): ChartMarker[] {
  const index = dayIndex(period, EDITING_PUBLIC);
  return index >= 0 ? [{ index, label: "Editing public" }] : [];
}

export function dailyChart(
  period: Period,
  series: LineSeries[],
  ariaLabel: string,
  format: NumberFormat = "int",
): LineChartProps {
  const { dates } = period;
  return {
    ariaLabel,
    series,
    format,
    xLabels: dates.map(formatDayMonth),
    titles: dates.map((d) => dayLabel(period, d)),
    xTickIndices: dailyTicks(dates.length),
    markers: editingPublicMarkers(period),
    partialIndex: dates.length - 1,
  };
}

export function dailyTable(period: Period, series: LineSeries[], format: NumberFormat = "int"): ChartTable {
  return {
    columns: ["Day", ...series.map((s) => s.label)],
    rows: period.dates.map((date, i) => [
      dayLabel(period, date),
      ...series.map((s) => {
        const value = s.values[i];
        if (value === null) return s.emptyLabel ?? "";
        return format === "int" ? value : formatNumber(value, format);
      }),
    ]),
  };
}
