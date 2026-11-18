// Pure logic behind the sections: windows, averages, the funnel, cohorts,
// weekly composition and account health. Unit-tested in logic.test.ts.

import { addDays, diffDays, type ISODate } from "@/lib/dates";

import {
  ACTIVATION_DAYS,
  COHORT_SPAN,
  COHORT_WEEKS,
  FUNNEL_WEEKS,
  HEALTH,
  RETURN_FROM_DAY,
  RETURN_TO_DAY,
} from "./config";
import { share } from "./filters";

const DAY_MS = 86_400_000;

/** PostHog's "2026-11-09 08:49:17.131000" (UTC) as milliseconds. */
export function toMs(timestamp: string): number {
  return Date.parse(`${timestamp.slice(0, 23).replace(" ", "T")}Z`);
}

/** Mean of the 4 values ending at `end`; null if one is missing or out of range. */
export function fourWeekMean(values: readonly (number | null)[], end: number): number | null {
  if (end < 3 || end >= values.length) return null;
  const window = values.slice(end - 3, end + 1);
  if (window.some((v) => v === null)) return null;
  return (window as number[]).reduce((sum, v) => sum + v, 0) / 4;
}

export interface Headline {
  /** The last complete week. */
  last: number | null;
  /** Mean of the 4 weeks ending with it. */
  average: number | null;
  /** That mean against the 4 weeks before it: 0.1 = 10% higher. */
  change: number | null;
}

export function headline(values: readonly (number | null)[], last: number): Headline {
  const average = fourWeekMean(values, last);
  const before = fourWeekMean(values, last - 4);
  return {
    last: values[last] ?? null,
    average,
    change: average !== null && before ? average / before - 1 : null,
  };
}

/** Middle value; the mean of the two middle ones for an even count. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface ActivationWindow {
  /** First registration counted: the later of 12 weeks back and citation tracking. */
  from: string;
  /** Registrations before this day (exclusive) have had their 28 days. */
  to: ISODate;
  /** False until someone registered after citations started has had 28 days. */
  ready: boolean;
  /** The day the funnel first has people. */
  firstReady: ISODate;
}

/**
 * Who the funnel follows: people registered in the 12 weeks before their 28
 * days could be over, and not before citations were tracked (the aha moment
 * needs them). Registration day is day 1, so someone who registered on
 * today − 28 had their day 28 yesterday.
 */
export function activationWindow(today: ISODate, citationsStarted: string): ActivationWindow {
  const to = addDays(today, -(RETURN_TO_DAY - 1));
  const twelveWeeks = `${addDays(to, -7 * FUNNEL_WEEKS)} 00:00:00`;
  const from = twelveWeeks > citationsStarted ? twelveWeeks : citationsStarted;
  return {
    from,
    to,
    ready: from < `${to} 00:00:00`,
    firstReady: addDays(citationsStarted.slice(0, 10), RETURN_TO_DAY),
  };
}

/** One registration: when, how, and the person's core actions and citations (timestamps, ascending). */
export interface Registration {
  registered: string;
  invited: boolean;
  core: string[];
  cited: string[];
}

export interface Stage {
  label: string;
  people: number;
  /** Share of the step before; null for the first step. */
  ofPrevious: number | null;
  /** Median days from registering to reaching this step; null for the first or when nobody did. */
  medianDays: number | null;
}

/** Day number of `timestamp`, the registration day being day 1. */
const dayNumber = (registered: string, timestamp: string) =>
  diffDays(registered.slice(0, 10), timestamp.slice(0, 10)) + 1;

/**
 * Registered → first core action → aha moment (a cited answer) → returned.
 * The first two count within days 1 to 14, returning is a core action on day
 * 8 to 28, and each step requires the ones above it.
 */
export function funnel(registrations: readonly Registration[]): Stage[] {
  const reached: { acted: number[]; aha: number[]; returned: number[] } = {
    acted: [],
    aha: [],
    returned: [],
  };
  for (const r of registrations) {
    const at = (timestamps: string[], ok: (day: number) => boolean) =>
      timestamps.find((t) => ok(dayNumber(r.registered, t)));
    const elapsed = (t: string) => (toMs(t) - toMs(r.registered)) / DAY_MS;
    const acted = at(r.core, (d) => d <= ACTIVATION_DAYS);
    const aha = at(r.cited, (d) => d <= ACTIVATION_DAYS);
    const back = at(r.core, (d) => d >= RETURN_FROM_DAY && d <= RETURN_TO_DAY);
    if (!acted) continue;
    reached.acted.push(elapsed(acted));
    if (!aha) continue;
    reached.aha.push(elapsed(aha));
    if (back) reached.returned.push(elapsed(back));
  }
  const steps: [string, number, number[] | null][] = [
    ["Registered", registrations.length, null],
    [`First core action within ${ACTIVATION_DAYS} days`, reached.acted.length, reached.acted],
    [`First sourced answer within ${ACTIVATION_DAYS} days`, reached.aha.length, reached.aha],
    [`Active again on day ${RETURN_FROM_DAY} to ${RETURN_TO_DAY}`, reached.returned.length, reached.returned],
  ];
  return steps.map(([label, people, days], i) => ({
    label,
    people,
    ofPrevious: i === 0 ? null : share(people, steps[i - 1][1]),
    medianDays: days && median(days),
  }));
}

/** A person's registration week (null when it was before the data) and every week with a core action. */
export interface PersonWeeks {
  registered: ISODate | null;
  weeks: ISODate[];
}

export interface CohortRow {
  week: ISODate;
  size: number;
  /** People active in week 0, 1, … after registering; null while that week isn't complete. */
  active: (number | null)[];
}

/** The last 16 complete registration weeks, newest first, each followed for weeks 0 to 8. */
export function cohortTable(people: readonly PersonWeeks[], lastWeek: ISODate): CohortRow[] {
  return Array.from({ length: COHORT_WEEKS }, (_, i) => {
    const week = addDays(lastWeek, -7 * i);
    const members = people.filter((p) => p.registered === week).map((p) => new Set(p.weeks));
    const active = Array.from({ length: COHORT_SPAN + 1 }, (_, k) => {
      const later = addDays(week, 7 * k);
      return later > lastWeek ? null : members.filter((weeks) => weeks.has(later)).length;
    });
    return { week, size: members.length, active };
  });
}

/** Week-k retention over every cohort whose week k is complete, weighted by cohort size. */
export function weightedRetention(rows: readonly CohortRow[], k: number): { active: number; size: number } {
  let active = 0;
  let size = 0;
  for (const row of rows) {
    const value = row.active[k];
    if (value === null || value === undefined) continue;
    active += value;
    size += row.size;
  }
  return { active, size };
}

export interface CompositionWeek {
  week: ISODate;
  /** Registered that week. */
  newPeople: number;
  /** Active this week and last week. */
  returning: number;
  /** Active this week, not last week, registered earlier. */
  cameBack: number;
  /** Active last week, not this week. */
  droppedOff: number;
}

export function composition(people: readonly PersonWeeks[], mondays: readonly ISODate[]): CompositionWeek[] {
  const sets = people.map((p) => ({ registered: p.registered, weeks: new Set(p.weeks) }));
  return mondays.map((week) => {
    const previous = addDays(week, -7);
    const row: CompositionWeek = { week, newPeople: 0, returning: 0, cameBack: 0, droppedOff: 0 };
    for (const p of sets) {
      const now = p.weeks.has(week);
      const before = p.weeks.has(previous);
      if (now && p.registered === week) row.newPeople++;
      else if (now && before) row.returning++;
      else if (now) row.cameBack++;
      else if (before) row.droppedOff++;
    }
    return row;
  });
}

export type Health = "red" | "amber" | "green";

/** Last week against the mean of the 4 weeks ending with it; null when that mean is 0. */
export function trend(weeks: readonly number[]): number | null {
  const mean = weeks.reduce((sum, v) => sum + v, 0) / weeks.length;
  return mean > 0 ? weeks[weeks.length - 1] / mean - 1 : null;
}

/**
 * Red: no core action in the last 14 days (today included) or seat activation
 * below 10%. Amber: seat activation below 30%, or last week 20% below the
 * organisation's own 4-week average. Green: everything else.
 */
export function health(
  org: { seats: number; activeLastWeek: number; trend: number | null; lastActivity: ISODate | null },
  today: ISODate,
): Health {
  const seatShare = share(org.activeLastWeek, org.seats) ?? 0;
  const idle = org.lastActivity === null || diffDays(org.lastActivity, today) >= HEALTH.inactiveDays;
  if (idle || seatShare < HEALTH.redSeats) return "red";
  if (seatShare < HEALTH.amberSeats || (org.trend !== null && org.trend < HEALTH.amberTrend)) return "amber";
  return "green";
}
