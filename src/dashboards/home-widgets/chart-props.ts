// Builds serialisable props for the shared chart components from home-widget data.

import type { ChartTable } from "@/components/charts/chart-card";
import type { ChartMarker, LineChartProps, LineSeries } from "@/components/charts/line-chart";
import { formatDayMonth, type ISODate } from "@/lib/dates";

import { TRACKING_STARTED, WIDGETS } from "./config";
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

/** Tooltip heading: says so on the days before tracking started, whose values are blank. */
function dayTitle(period: Period, date: ISODate): string {
  return date < period.from ? `${formatDayMonth(date)}, not tracked yet` : dayLabel(period, date);
}

export function trackingMarkers(period: Period): ChartMarker[] {
  const index = dayIndex(period, TRACKING_STARTED);
  return index >= 0 ? [{ index, label: "Tracking started" }] : [];
}

/** One line per known widget, in its own colour. Unknown widgets only show in tables. */
export function widgetSeries(byWidget: Record<string, (number | null)[]>): LineSeries[] {
  return WIDGETS.map((w) => ({
    key: w.id,
    label: w.label,
    color: w.color,
    values: byWidget[w.id] ?? [],
    emptyLabel: "–",
  }));
}

export function dailyChart(period: Period, series: LineSeries[], ariaLabel: string): LineChartProps {
  const { dates } = period;
  return {
    ariaLabel,
    series,
    xLabels: dates.map(formatDayMonth),
    titles: dates.map((d) => dayTitle(period, d)),
    xTickIndices: dailyTicks(dates.length),
    markers: trackingMarkers(period),
    partialIndex: dates.length - 1,
  };
}

/** Tracked days only: the days before tracking started have nothing to show. */
export function dailyTable(period: Period, series: LineSeries[]): ChartTable {
  return {
    columns: ["Day", ...series.map((s) => s.label)],
    rows: period.dates.flatMap((date, i) =>
      date < period.from ? [] : [[dayLabel(period, date), ...series.map((s) => s.values[i] ?? 0)]],
    ),
  };
}
