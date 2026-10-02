import "server-only";

import type { DashboardContext } from "@/dashboards/types";
import { addDays, type ISODate } from "@/lib/dates";
import { cachedHogQL, type QueryRecord } from "@/lib/posthog/cached-query";
import type { HogQLValue } from "@/lib/posthog/client";
import type { EnvKey } from "@/lib/posthog/environments";

import { INTERNAL_PEOPLE } from "./config";
import { derivePeriod, parseFilters, type Filters, type Period } from "./filters";
import {
  clicksByAction,
  clicksByWidget,
  clicksDaily,
  failuresDaily,
  homeTotals,
  newDrafts,
  openedDrafts,
  peopleFilter,
  reliabilityByWidget,
  requestFollowThrough,
} from "./queries";
import { dailyByWidget } from "./series";

export interface HWContext {
  today: ISODate;
  env: EnvKey;
  filters: Filters;
  period: Period;
  /** HogQL clause dropping internal users, or "" when everyone is counted. */
  people: string;
}

export function hwContext(ctx: DashboardContext): HWContext {
  const filters = parseFilters(ctx.searchParams);
  return {
    today: ctx.today,
    env: ctx.env,
    filters,
    period: derivePeriod(ctx.today, filters.days),
    people: peopleFilter(filters.excludeInternal ? INTERNAL_PEOPLE[ctx.env].sql : null),
  };
}

const dt = (iso: ISODate) => `${iso} 00:00:00`;
const num = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0) || 0);
const day = (value: unknown) => String(value).slice(0, 10) as ISODate;
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

function run(ctx: DashboardContext, name: string, sql: string, values: Record<string, HogQLValue>) {
  return cachedHogQL(ctx.projectId, ctx.dashboard, `${ctx.dashboard}:${name}`, sql, values);
}

/** The counted days: the period's first tracked day through today. */
const bounds = (hw: HWContext) => ({ start: dt(hw.period.from), end: dt(addDays(hw.today, 1)) });

async function single(ctx: DashboardContext, hw: HWContext, name: string, sql: string) {
  const { records, fetchedAt } = await run(ctx, name, sql, bounds(hw));
  return { r: records[0] ?? ({} as QueryRecord), fetchedAt };
}

function daily(hw: HWContext, records: QueryRecord[], column: string) {
  return dailyByWidget(
    hw.period.dates,
    records.map((r) => ({ day: day(r.day), widget: str(r.widget), value: num(r[column]) })),
    hw.period.from,
  );
}

// --- Interactions -----------------------------------------------------------------

export async function loadHomeTotals(ctx: DashboardContext, hw: HWContext) {
  const { r, fetchedAt } = await single(ctx, hw, "home-totals", homeTotals(hw.people));
  return {
    homePeople: num(r.home_people),
    homeViews: num(r.home_views),
    clickers: num(r.clickers),
    clicks: num(r.clicks),
    failedPeople: num(r.failed_people),
    fetchedAt,
  };
}

export interface WidgetClicks {
  widget: string;
  clicks: number;
  people: number;
}

export async function loadClicksByWidget(ctx: DashboardContext, hw: HWContext) {
  const { records, fetchedAt } = await run(ctx, "clicks-by-widget", clicksByWidget(hw.people), bounds(hw));
  const rows: WidgetClicks[] = records.map((r) => ({
    widget: str(r.widget),
    clicks: num(r.clicks),
    people: num(r.people),
  }));
  return { rows, fetchedAt };
}

export interface ActionClicks extends WidgetClicks {
  action: string;
}

export async function loadClicksByAction(ctx: DashboardContext, hw: HWContext) {
  const { records, fetchedAt } = await run(ctx, "clicks-by-action", clicksByAction(hw.people), bounds(hw));
  const rows: ActionClicks[] = records.map((r) => ({
    widget: str(r.widget),
    action: str(r.action),
    clicks: num(r.clicks),
    people: num(r.people),
  }));
  return { rows, fetchedAt };
}

export async function loadClicksDaily(ctx: DashboardContext, hw: HWContext) {
  const { records, fetchedAt } = await run(ctx, "clicks-daily", clicksDaily(hw.people), bounds(hw));
  return { byWidget: daily(hw, records, "clicks"), fetchedAt };
}

// --- Follow-through ---------------------------------------------------------------

export async function loadNewDrafts(ctx: DashboardContext, hw: HWContext) {
  const { r, fetchedAt } = await single(ctx, hw, "new-drafts", newDrafts(hw.people));
  return {
    clicks: num(r.clicks),
    messaged: num(r.messaged),
    messages: num(r.messages),
    listed: num(r.listed),
    stillOpen: num(r.still_open),
    fetchedAt,
  };
}

export async function loadOpenedDrafts(ctx: DashboardContext, hw: HWContext) {
  const { r, fetchedAt } = await single(ctx, hw, "opened-drafts", openedDrafts(hw.people));
  return {
    drafts: num(r.opened),
    linkedClicks: num(r.linked_clicks),
    listed: num(r.listed),
    stillOpen: num(r.still_open),
    fetchedAt,
  };
}

export async function loadRequestFollowThrough(ctx: DashboardContext, hw: HWContext) {
  const { r, fetchedAt } = await single(ctx, hw, "request-follow-through", requestFollowThrough(hw.people));
  return {
    people: num(r.people),
    completed: num(r.completed),
    stillOpen: num(r.still_open),
    fetchedAt,
  };
}

// --- Reliability ------------------------------------------------------------------

export interface WidgetReliability {
  widget: string;
  failures: number;
  /** People who saw this widget fail at least once. */
  people: number;
  retries: number;
  retriesWorked: number;
}

export async function loadReliability(ctx: DashboardContext, hw: HWContext) {
  const { records, fetchedAt } = await run(ctx, "reliability", reliabilityByWidget(hw.people), bounds(hw));
  const rows: WidgetReliability[] = records.map((r) => ({
    widget: str(r.widget),
    failures: num(r.failures),
    people: num(r.people),
    retries: num(r.retries),
    retriesWorked: num(r.retries_worked),
  }));
  return { rows, fetchedAt };
}

export async function loadFailuresDaily(ctx: DashboardContext, hw: HWContext) {
  const { records, fetchedAt } = await run(ctx, "failures-daily", failuresDaily(hw.people), bounds(hw));
  return { byWidget: daily(hw, records, "failures"), fetchedAt };
}
