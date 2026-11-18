import type { ChartMarker, LineChartProps, LineSeries } from "@/components/charts/line-chart";
import { formatNumber, type NumberFormat } from "@/components/charts/scale";

import { weeklyChart } from "../adoption/chart-props";
import { ANNOTATIONS, SMALL_BASE } from "./config";
import { share, weekIndex, type Period } from "./filters";

export { COLORS, weekCell, weeklyTable } from "../adoption/chart-props";

/** The annotations config as markers on a weekly chart, at the week they fall in, once their day has come. */
export function markers(period: Period): ChartMarker[] {
  return ANNOTATIONS.filter((a) => a.date <= period.end)
    .map((a) => ({ index: weekIndex(period, a.date), label: a.label }))
    .filter((m) => m.index >= 0);
}

/** A weekly line chart with the annotation markers. */
export function weeklyLines(
  period: Period,
  series: LineSeries[],
  ariaLabel: string,
  format: NumberFormat = "int",
): LineChartProps {
  return { ...weeklyChart(period, series, ariaLabel, format), markers: markers(period) };
}

/** "40% · 4/10", or "–" with nothing to divide by. Every share shows its count. */
export function ratio(part: number, whole: number): string {
  const value = share(part, whole);
  return value === null
    ? "–"
    : `${formatNumber(value, "percent")} · ${formatNumber(part)}/${formatNumber(whole)}`;
}

/** Shares over fewer than 5 are greyed out: too few to read. */
export const small = (whole: number) => whole < SMALL_BASE;
