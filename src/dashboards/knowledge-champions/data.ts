import "server-only";

import type { DashboardContext } from "@/dashboards/types";
import { addDays, dayRange, type ISODate } from "@/lib/dates";
import type { HogQLValue } from "@/lib/posthog/client";
import { cachedHogQL, type QueryRecord } from "@/lib/posthog/cached-query";

import { SEND_DATES } from "./config";
import {
  CLICKERS,
  FIRST_TIME_CREATORS,
  HISTORY_START,
  LIFECYCLE,
  LISTINGS_DAILY,
  TRACKING_START,
  WEEKLY,
  WINDOW_DAILY,
  WINDOW_UNIQUES,
  type MetricKey,
} from "./queries";
import {
  deriveWindows,
  latestSend,
  sendMarkers,
  weeklyRange,
  type SendWindows,
  type WeeklyRange,
} from "./windows";

export interface KCContext {
  today: ISODate;
  windows: SendWindows;
  weekly: WeeklyRange;
  /** Send dates to mark on weekly charts. */
  markers: ISODate[];
}

/** Null before the first send: there is nothing to compare yet. */
export function kcContext(ctx: DashboardContext): KCContext | null {
  const send = latestSend(SEND_DATES, ctx.today);
  if (!send) return null;
  const weekly = weeklyRange(ctx.today);
  return {
    today: ctx.today,
    windows: deriveWindows(send, ctx.today),
    weekly,
    markers: sendMarkers(SEND_DATES, weekly, ctx.today),
  };
}

const dt = (iso: ISODate) => `${iso} 00:00:00`;
const num = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0) || 0);
const day = (value: unknown) => String(value).slice(0, 10) as ISODate;

function run(ctx: DashboardContext, name: string, sql: string, values: Record<string, HogQLValue>) {
  return cachedHogQL(ctx.projectId, ctx.dashboard, `${ctx.dashboard}:${name}`, sql, values);
}

/** Exclusive end of the data we can have: tomorrow, or the window end if sooner. */
function queryEnd(kc: KCContext): ISODate {
  const windowEnd = addDays(kc.windows.after.end, 1);
  const tomorrow = addDays(kc.today, 1);
  return windowEnd < tomorrow ? windowEnd : tomorrow;
}

function byDate(records: QueryRecord[], column: string): Map<ISODate, number> {
  return new Map(records.map((r) => [day(r.day), num(r[column])]));
}

// --- Daily counts across both windows -------------------------------------

export type DailyMetric = "questions" | "contributions" | "new_listings" | "relists" | "clicks" | "clickers";

export async function loadWindowDaily(ctx: DashboardContext, kc: KCContext) {
  const { records, fetchedAt } = await run(ctx, "window-daily", WINDOW_DAILY, {
    start: dt(kc.windows.before.start),
    end: dt(queryEnd(kc)),
  });
  const metrics: DailyMetric[] = [
    "questions",
    "contributions",
    "new_listings",
    "relists",
    "clicks",
    "clickers",
  ];
  const counts = Object.fromEntries(metrics.map((m) => [m, byDate(records, m)])) as Record<
    DailyMetric,
    Map<ISODate, number>
  >;
  return { counts, fetchedAt };
}

// --- Unique people per window ------------------------------------------------

export interface UniqueCompare {
  /** Before-window days that line up with the after-window days so far. */
  beforeMatched: number;
  /** All 14 before-window days. */
  beforeFull: number;
  after: number;
}

export async function loadWindowUniques(ctx: DashboardContext, kc: KCContext) {
  const { windows } = kc;
  const { records, fetchedAt } = await run(ctx, "window-uniques", WINDOW_UNIQUES, {
    start: dt(windows.before.start),
    matched_end: dt(addDays(windows.before.start, windows.daysElapsed)),
    send: dt(windows.send),
    end: dt(queryEnd(kc)),
  });
  const r = records[0] ?? {};
  const compare = (prefix: string): UniqueCompare => ({
    beforeMatched: num(r[`${prefix}_before_matched`]),
    beforeFull: num(r[`${prefix}_before`]),
    after: num(r[`${prefix}_after`]),
  });
  return {
    asking: compare("asking"),
    contributing: compare("contributing"),
    active: compare("active"),
    clickers: num(r.clickers_after),
    fetchedAt,
  };
}

// --- First-time creators -----------------------------------------------------

export async function loadFirstTimeCreators(ctx: DashboardContext, kc: KCContext) {
  const { records, fetchedAt } = await run(ctx, "first-time-creators", FIRST_TIME_CREATORS, {
    history_start: HISTORY_START,
    start: dt(kc.windows.before.start),
    end: dt(queryEnd(kc)),
  });
  return { counts: byDate(records, "creators"), fetchedAt };
}

// --- Weekly series -------------------------------------------------------------

export type WeeklyMetric =
  | "questions"
  | "people_asking"
  | "contributions"
  | "contributors"
  | "new_listings"
  | "relists"
  | "active_people";

export async function loadWeekly(ctx: DashboardContext, kc: KCContext) {
  const { records, fetchedAt } = await run(ctx, "weekly", WEEKLY, {
    start: dt(kc.weekly.start),
    end: dt(addDays(kc.today, 1)),
  });
  const byWeek = new Map(records.map((r) => [day(r.week), r]));
  const metrics: WeeklyMetric[] = [
    "questions",
    "people_asking",
    "contributions",
    "contributors",
    "new_listings",
    "relists",
    "active_people",
  ];
  // Weeks without events come back missing; they are zeros, not gaps.
  const values = Object.fromEntries(
    metrics.map((m) => [m, kc.weekly.weeks.map((w) => num(byWeek.get(w)?.[m]))]),
  ) as Record<WeeklyMetric, number[]>;
  return { values, fetchedAt };
}

// --- Weekly lifecycle ----------------------------------------------------------

export interface LifecycleWeek {
  week: ISODate;
  newPeople: number;
  returning: number;
  cameBack: number;
  droppedOff: number;
}

export async function loadLifecycle(ctx: DashboardContext, kc: KCContext) {
  const { weeks } = kc.weekly;
  const { records, fetchedAt } = await run(ctx, "lifecycle", LIFECYCLE, {
    history_start: HISTORY_START,
    prev_start: dt(addDays(weeks[0], -7)),
    end: dt(addDays(kc.today, 1)),
    first_week: weeks[0],
    last_week: weeks.at(-1)!,
  });
  const byWeek = new Map(records.map((r) => [day(r.week), r]));
  const rows: LifecycleWeek[] = weeks.map((week) => {
    const r = byWeek.get(week);
    return {
      week,
      newPeople: num(r?.new_people),
      returning: num(r?.returning_people),
      cameBack: num(r?.came_back),
      droppedOff: num(r?.dropped_off),
    };
  });
  return { rows, fetchedAt };
}

// --- New listings, last 60 days ---------------------------------------------------

export const LISTING_LOOKBACK_DAYS = 60;

export async function loadListingsLast60(ctx: DashboardContext, kc: KCContext) {
  const start = addDays(kc.today, -(LISTING_LOOKBACK_DAYS - 1));
  const { records, fetchedAt } = await run(ctx, "listings-60d", LISTINGS_DAILY, {
    start: dt(start),
    end: dt(addDays(kc.today, 1)),
  });
  const counts = byDate(records, "new_listings");
  const days = dayRange(start, LISTING_LOOKBACK_DAYS).map((date) => ({
    date,
    count: counts.get(date) ?? 0,
  }));
  return { days, fetchedAt };
}

// --- When each metric was first tracked --------------------------------------------

export async function loadTrackingStart(ctx: DashboardContext, kc: KCContext) {
  const { records, fetchedAt } = await run(ctx, "tracking-start", TRACKING_START, {
    history_start: HISTORY_START,
    end: dt(addDays(kc.today, 1)),
  });
  const r = records[0] ?? {};
  const keys: MetricKey[] = ["question", "contribution", "newListing", "relist", "click", "active"];
  // minIf over no rows returns the epoch: treat it as "never tracked".
  const firstSeen = Object.fromEntries(
    keys.map((k) => {
      const value = r[k] ? day(r[k]) : null;
      return [k, value && value > "1970-01-01" ? value : null];
    }),
  ) as Record<MetricKey, ISODate | null>;
  return { firstSeen, fetchedAt };
}

// --- Clickers -------------------------------------------------------------------------

export interface BeforeAfter {
  before: number;
  after: number;
}

export interface ClickerRow {
  personId: string;
  name: string;
  firstClick: string;
  questions: BeforeAfter;
  contributions: BeforeAfter;
  listings: BeforeAfter;
  relists: BeforeAfter;
  actedWithin24h: boolean;
  contributedWithin7d: boolean;
  listedWithin7d: boolean;
}

export async function loadClickers(ctx: DashboardContext, kc: KCContext) {
  const { records, fetchedAt } = await run(ctx, "clickers", CLICKERS, {
    events_start: dt(addDays(kc.windows.send, -7)),
    send: dt(kc.windows.send),
    end: dt(addDays(kc.today, 1)),
  });
  const pair = (r: QueryRecord, key: string): BeforeAfter => ({
    before: num(r[`${key}_before`]),
    after: num(r[`${key}_after`]),
  });
  const rows: ClickerRow[] = records.map((r) => ({
    personId: String(r.person_id),
    name: String(r.person_name ?? ""),
    firstClick: String(r.first_click),
    questions: pair(r, "questions"),
    contributions: pair(r, "contributions"),
    listings: pair(r, "listings"),
    relists: pair(r, "relists"),
    actedWithin24h: Boolean(num(r.acted_within_24h)),
    contributedWithin7d: Boolean(num(r.contributed_within_7d)),
    listedWithin7d: Boolean(num(r.listed_within_7d)),
  }));
  return { rows, fetchedAt };
}
