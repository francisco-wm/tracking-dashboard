import "server-only";

import type { DashboardContext } from "@/dashboards/types";
import { addDays, type ISODate } from "@/lib/dates";
import { cachedHogQL, type QueryRecord } from "@/lib/posthog/cached-query";
import type { HogQLValue } from "@/lib/posthog/client";

import { INTERNAL_PEOPLE } from "./config";
import { derivePeriod, parseFilters, type Filters, type Period } from "./filters";
import {
  HISTORY_START,
  lifecycle,
  newPeople,
  organisations,
  peopleFilter,
  periodTotals,
  weeklyEvents,
  weeklyPeople,
} from "./queries";
import type { StartWeek } from "./returns";

export interface ADContext {
  today: ISODate;
  filters: Filters;
  period: Period;
  /** HogQL clause dropping internal users, or "" when everyone is counted. */
  people: string;
}

export function adContext(ctx: DashboardContext): ADContext {
  const filters = parseFilters(ctx.searchParams);
  return {
    today: ctx.today,
    filters,
    period: derivePeriod(ctx.today, filters.weeks),
    people: peopleFilter(filters.excludeInternal ? INTERNAL_PEOPLE[ctx.env].sql : null),
  };
}

const dt = (iso: ISODate) => `${iso} 00:00:00`;
const num = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0) || 0);
const day = (value: unknown) => String(value).slice(0, 10) as ISODate;

function run(ctx: DashboardContext, name: string, sql: string, values: Record<string, HogQLValue>) {
  return cachedHogQL(ctx.projectId, ctx.dashboard, `${ctx.dashboard}:${name}`, sql, values);
}

/** The period: its first Monday through today. */
const bounds = (ad: ADContext) => ({ start: dt(ad.period.start), end: dt(addDays(ad.today, 1)) });

/** One value per week of the period; weeks without events come back missing and are zeros. */
function perWeek<T>(ad: ADContext, records: QueryRecord[], build: (week: ISODate, r: QueryRecord) => T): T[] {
  const byWeek = new Map(records.map((r) => [day(r.week), r]));
  return ad.period.mondays.map((week) => build(week, byWeek.get(week) ?? {}));
}

export async function loadTotals(ctx: DashboardContext, ad: ADContext) {
  const { records, fetchedAt } = await run(ctx, "period-totals", periodTotals(ad.people), bounds(ad));
  return { active: num(records[0]?.active), fetchedAt };
}

export interface PeopleWeek {
  week: ISODate;
  active: number;
  /** Of the active people, how many asked a question that week. */
  asking: number;
  contributing: number;
  /** A new listing or a re-list. */
  listing: number;
}

export async function loadWeeklyPeople(ctx: DashboardContext, ad: ADContext) {
  const { records, fetchedAt } = await run(ctx, "weekly-people", weeklyPeople(ad.people), bounds(ad));
  const weeks = perWeek<PeopleWeek>(ad, records, (week, r) => ({
    week,
    active: num(r.active),
    asking: num(r.asking),
    contributing: num(r.contributing),
    listing: num(r.listing),
  }));
  return { weeks, fetchedAt };
}

export interface EventsWeek {
  week: ISODate;
  /** Organisations with at least one active person. */
  orgs: number;
  requestsCreated: number;
  requestsAnswered: number;
}

export async function loadWeeklyEvents(ctx: DashboardContext, ad: ADContext) {
  const { records, fetchedAt } = await run(ctx, "weekly-events", weeklyEvents(ad.people), bounds(ad));
  const weeks = perWeek<EventsWeek>(ad, records, (week, r) => ({
    week,
    orgs: num(r.orgs),
    requestsCreated: num(r.requests_created),
    requestsAnswered: num(r.requests_answered),
  }));
  return { weeks, fetchedAt };
}

export interface LifecycleWeek {
  week: ISODate;
  newPeople: number;
  returning: number;
  cameBack: number;
  droppedOff: number;
}

export async function loadLifecycle(ctx: DashboardContext, ad: ADContext) {
  const { period } = ad;
  const { records, fetchedAt } = await run(ctx, "lifecycle", lifecycle(ad.people), {
    history_start: HISTORY_START,
    prev_start: dt(addDays(period.start, -7)),
    end: dt(addDays(ad.today, 1)),
    first_week: dt(period.start),
    last_week: dt(period.thisWeek),
  });
  const weeks = perWeek<LifecycleWeek>(ad, records, (week, r) => ({
    week,
    newPeople: num(r.new_people),
    returning: num(r.returning_people),
    cameBack: num(r.came_back),
    droppedOff: num(r.dropped_off),
  }));
  return { weeks, fetchedAt };
}

export async function loadNewPeople(ctx: DashboardContext, ad: ADContext) {
  const { records, fetchedAt } = await run(ctx, "new-people", newPeople(ad.people), {
    history_start: HISTORY_START,
    ...bounds(ad),
  });
  const weeks = perWeek<StartWeek>(ad, records, (week, r) => ({
    week,
    newPeople: num(r.new_people),
    returned: num(r.returned),
  }));
  return { weeks, fetchedAt };
}

export interface OrgRow {
  /** The organisation's slug, i.e. its name. Only shown when the viewer asks. */
  slug: string;
  firstActive: ISODate;
  people: number;
  peopleLastWeek: number;
  weeks: number;
}

export async function loadOrganisations(ctx: DashboardContext, ad: ADContext) {
  const { period } = ad;
  const { records, fetchedAt } = await run(ctx, "organisations", organisations(ad.people), {
    history_start: HISTORY_START,
    ...bounds(ad),
    last_full_week: dt(period.lastWeek),
    this_week: dt(period.thisWeek),
  });
  const rows: OrgRow[] = records.map((r) => ({
    slug: String(r.org ?? ""),
    firstActive: day(r.first_active),
    people: num(r.people),
    peopleLastWeek: num(r.people_last_week),
    weeks: num(r.weeks),
  }));
  return { rows, fetchedAt };
}
