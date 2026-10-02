import "server-only";

import type { DashboardContext } from "@/dashboards/types";
import { addDays, type ISODate } from "@/lib/dates";
import { cachedHogQL } from "@/lib/posthog/cached-query";
import type { HogQLValue } from "@/lib/posthog/client";

import { INTERNAL_PEOPLE } from "./config";
import { derivePeriod, parseFilters, type Filters, type Period } from "./filters";
import { completionDaily, completionTotals, listingsDaily, listingTotals, peopleFilter } from "./queries";

export interface FEContext {
  today: ISODate;
  filters: Filters;
  period: Period;
  /** HogQL clause dropping internal users, or "" when everyone is counted. */
  people: string;
}

export function feContext(ctx: DashboardContext): FEContext {
  const filters = parseFilters(ctx.searchParams);
  return {
    today: ctx.today,
    filters,
    period: derivePeriod(ctx.today, filters.days),
    people: peopleFilter(filters.excludeInternal ? INTERNAL_PEOPLE[ctx.env].sql : null),
  };
}

const dt = (iso: ISODate) => `${iso} 00:00:00`;
const num = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0) || 0);
const day = (value: unknown) => String(value).slice(0, 10) as ISODate;

function run(ctx: DashboardContext, name: string, sql: string, values: Record<string, HogQLValue>) {
  return cachedHogQL(ctx.projectId, ctx.dashboard, `${ctx.dashboard}:${name}`, sql, values);
}

/** The period: its first day through today. */
const bounds = (fe: FEContext) => ({ start: dt(fe.period.start), end: dt(addDays(fe.today, 1)) });

// --- Listings -------------------------------------------------------------------

export async function loadListingTotals(ctx: DashboardContext, fe: FEContext) {
  const { records, fetchedAt } = await run(ctx, "listing-totals", listingTotals(fe.people), bounds(fe));
  const r = records[0] ?? {};
  return {
    newListings: num(r.new_listings),
    relists: num(r.relists),
    relistedFragments: num(r.relisted_fragments),
    fetchedAt,
  };
}

export async function loadListingsDaily(ctx: DashboardContext, fe: FEContext) {
  const { records, fetchedAt } = await run(ctx, "listings-daily", listingsDaily(fe.people), bounds(fe));
  const byDay = new Map(records.map((r) => [day(r.day), r]));
  // Days without events come back missing; they are zeros, not gaps.
  const values = (column: string) => fe.period.dates.map((d) => num(byDay.get(d)?.[column]));
  return { newListings: values("new_listings"), relists: values("relists"), fetchedAt };
}

// --- Edit completion ----------------------------------------------------------------

export interface CompletionCounts {
  /** Fragments someone started editing. */
  started: number;
  /** Of those, re-listed within the completion window. */
  listed: number;
}

export async function loadCompletionTotals(ctx: DashboardContext, fe: FEContext) {
  const { records, fetchedAt } = await run(ctx, "completion-totals", completionTotals(fe.people), bounds(fe));
  const r = records[0] ?? {};
  return { started: num(r.started), listed: num(r.listed), stillOpen: num(r.still_open), fetchedAt };
}

export interface CompletionDay extends CompletionCounts {
  date: ISODate;
}

export async function loadCompletionDaily(ctx: DashboardContext, fe: FEContext) {
  const { records, fetchedAt } = await run(ctx, "completion-daily", completionDaily(fe.people), bounds(fe));
  const byDay = new Map(records.map((r) => [day(r.day), r]));
  const days: CompletionDay[] = fe.period.dates.map((date) => ({
    date,
    started: num(byDay.get(date)?.started),
    listed: num(byDay.get(date)?.listed),
  }));
  return { days, fetchedAt };
}
