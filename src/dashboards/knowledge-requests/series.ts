// Pure shaping of requests and gaps into one value per counted day. Each
// series groups by the day a request was sent (or a gap detected), so the
// daily values add up to the tiles above them.

import type { ISODate } from "@/lib/dates";

import type { RequestRow } from "./lifecycle";

export interface DailyRequests {
  sent: number[];
  /** Of the requests sent that day, those with at least one answer. */
  answered: number[];
  /** Of the requests sent that day, those resolved. */
  resolved: number[];
}

export function dailyRequests(dates: ISODate[], rows: RequestRow[]): DailyRequests {
  const index = new Map(dates.map((d, i) => [d, i]));
  const zeros = () => dates.map(() => 0);
  const out: DailyRequests = { sent: zeros(), answered: zeros(), resolved: zeros() };
  for (const row of rows) {
    const i = index.get(row.sentDay);
    if (i === undefined) continue;
    out.sent[i] += 1;
    if (row.answers.length > 0) out.answered[i] += 1;
    if (row.close?.outcome === "resolved") out.resolved[i] += 1;
  }
  return out;
}

export interface GapDay {
  day: ISODate;
  /** Every gap detected that day. */
  detected: number;
  /** Those carrying their request's id, so they can be matched. */
  linked: number;
  /** Of those, the ones whose request was sent. */
  sent: number;
}

export interface DailyGaps {
  detected: number[];
  sent: number[];
}

export function dailyGaps(dates: ISODate[], days: GapDay[]): DailyGaps {
  const index = new Map(dates.map((d, i) => [d, i]));
  const out: DailyGaps = { detected: dates.map(() => 0), sent: dates.map(() => 0) };
  for (const g of days) {
    const i = index.get(g.day);
    if (i === undefined) continue;
    out.detected[i] += g.detected;
    out.sent[i] += g.sent;
  }
  return out;
}

/** Totals over the days. */
export function gapTotals(days: GapDay[]): { detected: number; linked: number; sent: number } {
  return days.reduce(
    (sum, g) => ({
      detected: sum.detected + g.detected,
      linked: sum.linked + g.linked,
      sent: sum.sent + g.sent,
    }),
    { detected: 0, linked: 0, sent: 0 },
  );
}
