// Coming back after the first two weeks: active again on day 15 to 28,
// counting a person's first active day as day 1.

import { addDays, type ISODate } from "@/lib/dates";

import { RETURN_TO_DAY } from "./config";
import { share } from "./filters";

/** People whose first active day ever fell in `week`, and how many of them came back. */
export interface StartWeek {
  week: ISODate;
  newPeople: number;
  /** Active again on day 15 to 28. Only final once the week's window has closed. */
  returned: number;
}

/**
 * Whether everyone who started in `week` has had their day 28, so the week's
 * return rate is final. The last of them started on the Sunday (their day 1),
 * and today, still in progress, doesn't count as over.
 */
export function returnWindowClosed(week: ISODate, today: ISODate): boolean {
  return addDays(week, 6 + RETURN_TO_DAY) < today;
}

/** A start week's return rate; null while its window is open or when nobody started. */
export function returnRate(week: StartWeek, today: ISODate): number | null {
  return returnWindowClosed(week.week, today) ? share(week.returned, week.newPeople) : null;
}

export interface ReturnSummary {
  /** Everyone who started in the period. */
  started: number;
  /** Of those, people in weeks whose window has closed: the rate's base. */
  counted: number;
  /** Of `counted`, how many came back. */
  returned: number;
  /** People in weeks whose window is still open: they count later. */
  stillOpen: number;
  /** The last day of the latest closed week; null when no week has closed. */
  countedUntil: ISODate | null;
}

export function summariseReturns(weeks: readonly StartWeek[], today: ISODate): ReturnSummary {
  const summary: ReturnSummary = { started: 0, counted: 0, returned: 0, stillOpen: 0, countedUntil: null };
  for (const w of weeks) {
    summary.started += w.newPeople;
    if (returnWindowClosed(w.week, today)) {
      summary.counted += w.newPeople;
      summary.returned += w.returned;
      summary.countedUntil = addDays(w.week, 6);
    } else {
      summary.stillOpen += w.newPeople;
    }
  }
  return summary;
}
