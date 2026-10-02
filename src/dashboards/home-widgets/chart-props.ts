// Builds serialisable props for the shared chart components from home-widget data.

import type { ChartTable } from "@/components/charts/chart-card";
import type { ChartMarker, LineChartProps, LineSeries } from "@/components/charts/line-chart";
import { formatDayMonth, type ISODate } from "@/lib/dates";
import type { EnvKey } from "@/lib/posthog/environments";

import { WIDGETS, WIDGETS_LIVE } from "./config";
import { dayIndex, type Period } from "./filters";

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

export function widgetsLiveMarkers(period: Period, env: EnvKey): ChartMarker[] {
  const index = dayIndex(period, WIDGETS_LIVE[env]);
  return index >= 0 ? [{ index, label: "Widgets live" }] : [];
}

/** One line per known widget, in its own colour. Unknown widgets only show in tables. */
export function widgetSeries(byWidget: Record<string, number[]>): LineSeries[] {
  return WIDGETS.map((w) => ({ key: w.id, label: w.label, color: w.color, values: byWidget[w.id] ?? [] }));
}

export function dailyChart(
  period: Period,
  env: EnvKey,
  series: LineSeries[],
  ariaLabel: string,
): LineChartProps {
  const { dates } = period;
  return {
    ariaLabel,
    series,
    xLabels: dates.map(formatDayMonth),
    titles: dates.map((d) => dayLabel(period, d)),
    xTickIndices: dailyTicks(dates.length),
    markers: widgetsLiveMarkers(period, env),
    partialIndex: dates.length - 1,
  };
}

export function dailyTable(period: Period, series: LineSeries[]): ChartTable {
  return {
    columns: ["Day", ...series.map((s) => s.label)],
    rows: period.dates.map((date, i) => [dayLabel(period, date), ...series.map((s) => s.values[i] ?? 0)]),
  };
}
