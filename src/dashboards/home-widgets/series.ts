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
 * the data has that this dashboard doesn't know yet. Days without events are
 * zeros, not gaps; rows outside `dates` are ignored.
 */
export function dailyByWidget(dates: ISODate[], rows: DailyRow[]): Record<string, number[]> {
  const index = new Map(dates.map((d, i) => [d, i]));
  const out: Record<string, number[]> = {};
  for (const w of WIDGETS) out[w.id] = dates.map(() => 0);
  for (const row of rows) {
    const i = index.get(row.day);
    if (i === undefined) continue;
    out[row.widget] ??= dates.map(() => 0);
    out[row.widget][i] += row.value;
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
