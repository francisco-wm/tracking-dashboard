import { addDays, dayRange, mondayOf, mondayWeeks, type ISODate } from "@/lib/dates";

export const WINDOW_DAYS = 14;
export const WEEKLY_WEEKS = 26; // ~6 months

export interface DayWindow {
  start: ISODate;
  /** Inclusive. */
  end: ISODate;
  /** WINDOW_DAYS dates; index 0 is "day 1". */
  days: ISODate[];
}

export interface SendWindows {
  send: ISODate;
  before: DayWindow;
  after: DayWindow;
  /** After-window days that have started (send day counts as day 1). */
  daysElapsed: number;
}

/**
 * The send that drives the page: the latest configured send on or before
 * today. A future send added early to the config is ignored until its day.
 */
export function latestSend(sendDates: readonly ISODate[], today: ISODate): ISODate | null {
  const past = sendDates.filter((date) => date <= today).sort();
  return past.at(-1) ?? null;
}

/** After = send day + 13 days. Before = the 14 days immediately before the send. */
export function deriveWindows(send: ISODate, today: ISODate): SendWindows {
  const afterDays = dayRange(send, WINDOW_DAYS);
  const beforeDays = dayRange(addDays(send, -WINDOW_DAYS), WINDOW_DAYS);
  return {
    send,
    before: { start: beforeDays[0], end: beforeDays.at(-1)!, days: beforeDays },
    after: { start: afterDays[0], end: afterDays.at(-1)!, days: afterDays },
    daysElapsed: afterDays.filter((date) => date <= today).length,
  };
}

export interface DayPair {
  /** 1-based day index within each window. */
  day: number;
  beforeDate: ISODate;
  afterDate: ISODate;
  before: number;
  /** null for after-window days that haven't happened yet. */
  after: number | null;
}

/** Matches before and after by day index (day 1 vs day 1, …). */
export function alignByDayIndex(windows: SendWindows, countsByDate: ReadonlyMap<ISODate, number>): DayPair[] {
  return windows.before.days.map((beforeDate, i) => {
    const afterDate = windows.after.days[i];
    const happened = i < windows.daysElapsed;
    return {
      day: i + 1,
      beforeDate,
      afterDate,
      before: countsByDate.get(beforeDate) ?? 0,
      after: happened ? (countsByDate.get(afterDate) ?? 0) : null,
    };
  });
}

/** Running totals for both lines; days that haven't happened stay null. */
export function runningTotals(pairs: readonly DayPair[]): DayPair[] {
  let before = 0;
  let after = 0;
  return pairs.map((pair) => {
    before += pair.before;
    if (pair.after !== null) after += pair.after;
    return { ...pair, before, after: pair.after === null ? null : after };
  });
}

export interface WeeklyRange {
  /** Monday dates, oldest first. */
  weeks: ISODate[];
  /** First day of the range, for query bounds. */
  start: ISODate;
  /** The current week; it is still in progress. */
  partialWeek: ISODate;
}

export function weeklyRange(today: ISODate, count = WEEKLY_WEEKS): WeeklyRange {
  const weeks = mondayWeeks(today, count);
  return { weeks, start: weeks[0], partialWeek: mondayOf(today) };
}

/** Send dates that fall inside the weekly range and have happened, oldest first. */
export function sendMarkers(sendDates: readonly ISODate[], range: WeeklyRange, today: ISODate): ISODate[] {
  return sendDates.filter((date) => date >= range.start && date <= today).sort();
}

export interface ZeroRun {
  length: number;
  start: ISODate;
  end: ISODate;
}

/** Longest run of consecutive zero days, in date order. */
export function longestZeroRun(days: readonly { date: ISODate; count: number }[]): ZeroRun | null {
  let best: ZeroRun | null = null;
  let runStart = -1;
  days.forEach(({ count }, i) => {
    if (count !== 0) {
      runStart = -1;
      return;
    }
    if (runStart < 0) runStart = i;
    const length = i - runStart + 1;
    if (!best || length > best.length) {
      best = { length, start: days[runStart].date, end: days[i].date };
    }
  });
  return best;
}
