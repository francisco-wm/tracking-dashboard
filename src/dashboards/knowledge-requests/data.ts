import "server-only";

import type { DashboardContext } from "@/dashboards/types";
import { addDays, type ISODate } from "@/lib/dates";
import { cachedHogQL } from "@/lib/posthog/cached-query";
import type { HogQLValue } from "@/lib/posthog/client";
import type { EnvKey } from "@/lib/posthog/environments";

import { INTERNAL_PEOPLE, TRACKING_LOOKBACK, TRACKING_STARTED } from "./config";
import { derivePeriod, parseFilters, type Filters, type Period } from "./filters";
import { parseRequest } from "./lifecycle";
import { gapsDaily, peopleFilter, requests, trackingStatus } from "./queries";
import { gapTotals, type GapDay } from "./series";
import { parseTrackingStatus, type TrackingStatus } from "./tracking";

export interface KRContext {
  today: ISODate;
  env: EnvKey;
  filters: Filters;
  period: Period;
  /** HogQL clause dropping internal users, or "" when everyone is counted. */
  people: string;
}

export function krContext(ctx: DashboardContext): KRContext {
  const filters = parseFilters(ctx.searchParams);
  return {
    today: ctx.today,
    env: ctx.env,
    filters,
    period: derivePeriod(ctx.today, filters.days, TRACKING_STARTED[ctx.env]),
    people: peopleFilter(filters.excludeInternal ? INTERNAL_PEOPLE[ctx.env].sql : null),
  };
}

const dt = (iso: ISODate) => `${iso} 00:00:00`;
const num = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0) || 0);
function run(ctx: DashboardContext, name: string, sql: string, values: Record<string, HogQLValue>) {
  return cachedHogQL(ctx.projectId, ctx.dashboard, `${ctx.dashboard}:${name}`, sql, values);
}

/** The counted days: from the tracking start (or the range's first day) through today. */
const bounds = (kr: KRContext) => ({ start: dt(kr.period.from), end: dt(addDays(kr.today, 1)) });

export async function loadTracking(ctx: DashboardContext, kr: KRContext) {
  const { records, fetchedAt } = await run(ctx, "tracking", trackingStatus(), {
    since: dt(TRACKING_LOOKBACK),
    end: dt(addDays(kr.today, 1)),
  });
  const status: TrackingStatus = parseTrackingStatus(records[0] ?? {});
  return { status, fetchedAt };
}

export async function loadRequests(ctx: DashboardContext, kr: KRContext) {
  const { records, fetchedAt } = await run(ctx, "requests", requests(kr.people), bounds(kr));
  const rows = records.map(parseRequest);
  // The query's own clock, so "sent in the last 7 days" matches the data; no rows, no clock needed.
  const now = records.length > 0 ? num(records[0].now) : Math.floor(Date.parse(fetchedAt) / 1000);
  return { rows, now, fetchedAt };
}

export async function loadGaps(ctx: DashboardContext, kr: KRContext) {
  const { records, fetchedAt } = await run(ctx, "gaps-daily", gapsDaily(kr.people), bounds(kr));
  const days: GapDay[] = records.map((r) => ({
    day: String(r.day).slice(0, 10),
    detected: num(r.detected),
    linked: num(r.linked),
    sent: num(r.sent),
  }));
  return { ...gapTotals(days), days, fetchedAt };
}
