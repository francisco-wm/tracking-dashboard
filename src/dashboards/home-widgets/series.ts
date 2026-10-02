// Pure shaping of query rows into per-widget series and table order.

import type { ISODate } from "@/lib/dates";

import { WIDGETS } from "./config";

export interface DailyRow {
  day: ISODate;
  widget: string;
  value: number;
}

/**
 * One value per day of `dates` for every widget: each known widget, plus any
 * the data has that this dashboard doesn't know yet. Days before `from` weren't
 * tracked and are null (no line); later days without events are zeros, not
 * gaps. Rows outside the tracked days are ignored.
 */
export function dailyByWidget(
  dates: ISODate[],
  rows: DailyRow[],
  from: ISODate = dates[0],
): Record<string, (number | null)[]> {
  const index = new Map(dates.map((d, i) => [d, i]));
  const empty = () => dates.map((d) => (d < from ? null : 0));
  const out: Record<string, (number | null)[]> = {};
  for (const w of WIDGETS) out[w.id] = empty();
  for (const row of rows) {
    const i = index.get(row.day);
    if (i === undefined || row.day < from) continue;
    out[row.widget] ??= empty();
    out[row.widget][i] = (out[row.widget][i] ?? 0) + row.value;
  }
  return out;
}

/** Known widgets in their fixed order, then unknown ones by `value`, highest first. */
export function byWidgetOrder<T extends { widget: string }>(rows: T[], value: (row: T) => number): T[] {
  const rank = (id: string) => {
    const i = WIDGETS.findIndex((w) => w.id === id);
    return i < 0 ? WIDGETS.length : i;
  };
  return [...rows].sort((a, b) => rank(a.widget) - rank(b.widget) || value(b) - value(a));
}
