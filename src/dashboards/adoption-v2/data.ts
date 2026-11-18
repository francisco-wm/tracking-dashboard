import "server-only";

import type { DashboardContext } from "@/dashboards/types";
import { addDays, type ISODate } from "@/lib/dates";
import { cachedHogQL, type QueryRecord } from "@/lib/posthog/cached-query";
import type { HogQLValue } from "@/lib/posthog/client";
import type { EnvKey } from "@/lib/posthog/environments";

import { INTERNAL_PEOPLE } from "../adoption/config";
import { HISTORY_START, peopleFilter } from "../adoption/queries";
import { ANSWERS_STARTED, CITATIONS_STARTED, COHORT_WEEKS, INVITE_DAYS } from "./config";
import { derivePeriod, parseFilters, type Filters, type Period } from "./filters";
import { activationWindow, type PersonWeeks, type Registration } from "./logic";
import {
  answers,
  invites,
  organisations,
  personWeeks,
  registrations,
  requests,
  reuse,
  weekly,
} from "./queries";

export interface V2Context {
  env: EnvKey;
  today: ISODate;
  filters: Filters;
  period: Period;
  /** HogQL clause dropping internal users, or "" when everyone is counted. */
  people: string;
}

export function v2Context(ctx: DashboardContext): V2Context {
  const filters = parseFilters(ctx.searchParams);
  return {
    env: ctx.env,
    today: ctx.today,
    filters,
    period: derivePeriod(ctx.today, filters.weeks),
    people: peopleFilter(filters.excludeInternal ? INTERNAL_PEOPLE[ctx.env].sql : null),
  };
}

const dt = (iso: ISODate) => `${iso} 00:00:00`;
const later = (a: string, b: string) => (a > b ? a : b);
const num = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0) || 0);
const day = (value: unknown) => String(value).slice(0, 10) as ISODate;
const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
/** Tomorrow, so today's events count. */
const end = (v: V2Context) => dt(addDays(v.today, 1));

function run(ctx: DashboardContext, name: string, sql: string, values: Record<string, HogQLValue>) {
  return cachedHogQL(ctx.projectId, ctx.dashboard, `${ctx.dashboard}:${name}`, sql, values);
}

/** One value per week of the period; weeks without events are zeros. */
function perWeek<T>(v: V2Context, records: QueryRecord[], build: (week: ISODate, r: QueryRecord) => T): T[] {
  const byWeek = new Map(records.map((r) => [day(r.week), r]));
  return v.period.mondays.map((week) => build(week, byWeek.get(week) ?? {}));
}

/** The day citations started, for "since …" wording. */
export const citationsDay = (v: V2Context) => day(CITATIONS_STARTED[v.env]);

/** Weeks entirely before `started` have no data for that metric: null, not 0. */
const tracked = (week: ISODate, started: string) => dt(addDays(week, 7)) > started;

export interface Week {
  week: ISODate;
  active: number;
  orgs: number;
  questions: number;
  askers: number;
  /** Knowledge going in: drafts listed for the first time, edits re-listed, files uploaded to company knowledge. */
  fragmentsListed: number;
  fragmentsRelisted: number;
  filesUploaded: number;
  /** Files attached in a chat. */
  filesAttached: number;
  contributors: number;
  /** People who did each core action that week; someone can do several. */
  doing: {
    chatting: number;
    drafting: number;
    uploading: number;
    editing: number;
    listing: number;
    attaching: number;
    requesting: number;
    answering: number;
  };
  requests: number;
  registrations: number;
  invited: number;
  ratedUp: number;
  ratedDown: number;
}

export async function loadWeekly(ctx: DashboardContext, v: V2Context) {
  const { records, fetchedAt } = await run(ctx, "weekly", weekly(v.people), {
    history_start: HISTORY_START,
    start: dt(v.period.start),
    end: end(v),
  });
  const weeks = perWeek<Week>(v, records, (week, r) => ({
    week,
    active: num(r.active),
    orgs: num(r.orgs),
    questions: num(r.questions),
    askers: num(r.askers),
    fragmentsListed: num(r.fragments_listed),
    fragmentsRelisted: num(r.fragments_relisted),
    filesUploaded: num(r.files_uploaded),
    filesAttached: num(r.files_attached),
    contributors: num(r.contributors),
    doing: {
      chatting: num(r.askers),
      drafting: num(r.people_drafting),
      uploading: num(r.people_uploading),
      editing: num(r.people_editing),
      listing: num(r.people_listing),
      attaching: num(r.people_attaching),
      requesting: num(r.people_requesting),
      answering: num(r.people_answering),
    },
    requests: num(r.requests),
    registrations: num(r.registrations),
    invited: num(r.invited),
    ratedUp: num(r.rated_up),
    ratedDown: num(r.rated_down),
  }));
  return { weeks, fetchedAt };
}

export interface AnswerRow {
  week: ISODate;
  org: string;
  questions: number;
  sourced: number;
}

/** Chat questions and sourced answers per week and organisation, since citations were tracked. */
export async function loadAnswers(ctx: DashboardContext, v: V2Context) {
  const started = CITATIONS_STARTED[v.env];
  const { records, fetchedAt } = await run(ctx, "answers", answers(v.people), {
    start: later(dt(v.period.start), started),
    end: end(v),
  });
  const rows: AnswerRow[] = records.map((r) => ({
    week: day(r.week),
    org: String(r.org ?? ""),
    questions: num(r.questions),
    sourced: num(r.sourced),
  }));
  // Per week; null before citations were tracked.
  const weeks = v.period.mondays.map((week) => {
    if (!tracked(week, started)) return { week, questions: null, sourced: null };
    const inWeek = rows.filter((r) => r.week === week);
    return {
      week,
      questions: inWeek.reduce((sum, r) => sum + r.questions, 0),
      sourced: inWeek.reduce((sum, r) => sum + r.sourced, 0),
    };
  });
  return { rows, weeks, fetchedAt };
}

export interface OrgRow {
  id: string;
  /** A customer's name: only shown when the viewer asks. */
  name: string;
  seats: number;
  /** Active people in each of the 4 weeks ending last week, oldest first. */
  weeks: number[];
  lastActivity: ISODate | null;
  questions: number;
  /** Fragments listed, edits re-listed and files uploaded in the 4 weeks. */
  knowledgeIn: number;
  requests: number;
}

export async function loadOrganisations(ctx: DashboardContext, v: V2Context) {
  const { lastWeek, thisWeek } = v.period;
  const { records, fetchedAt } = await run(ctx, "organisations", organisations(v.people), {
    history_start: HISTORY_START,
    end: end(v),
    w1: dt(addDays(lastWeek, -21)),
    w2: dt(addDays(lastWeek, -14)),
    w3: dt(addDays(lastWeek, -7)),
    w4: dt(lastWeek),
    this_week: dt(thisWeek),
  });
  const rows: OrgRow[] = records.map((r) => {
    const last = day(r.last_activity);
    return {
      id: String(r.org ?? ""),
      name: String(r.name ?? ""),
      seats: num(r.seats),
      weeks: [num(r.w1), num(r.w2), num(r.w3), num(r.w4)],
      // maxIf over no rows is the epoch
      lastActivity: last > "2000-01-01" ? last : null,
      questions: num(r.questions),
      knowledgeIn: num(r.knowledge_in),
      requests: num(r.requests),
    };
  });
  return { rows, fetchedAt };
}

/** People registered or active since the earlier of the period and the oldest cohort. */
export async function loadPersonWeeks(ctx: DashboardContext, v: V2Context) {
  const { period } = v;
  const oldestCohort = addDays(period.lastWeek, -7 * (COHORT_WEEKS - 1));
  const start = addDays(period.start, -7) < oldestCohort ? addDays(period.start, -7) : oldestCohort;
  const { records, fetchedAt } = await run(ctx, "person-weeks", personWeeks(v.people), {
    start: dt(start),
    end: end(v),
  });
  const people: PersonWeeks[] = records.map((r) => {
    const registered = day(r.registered);
    return {
      registered: registered >= start ? registered : null,
      weeks: strings(r.active_weeks).map(day),
    };
  });
  return { people, fetchedAt };
}

/** Registrations the funnel follows, or none until the window has people. */
export async function loadRegistrations(ctx: DashboardContext, v: V2Context) {
  const window = activationWindow(v.today, CITATIONS_STARTED[v.env]);
  if (!window.ready)
    return { window, registrations: [] as Registration[], fetchedAt: new Date().toISOString() };
  const { records, fetchedAt } = await run(ctx, "registrations", registrations(v.people), {
    from: window.from,
    to: dt(window.to),
    end: end(v),
  });
  const rows: Registration[] = records.map((r) => ({
    registered: String(r.registered),
    invited: Boolean(r.invited),
    core: strings(r.core_times),
    cited: strings(r.cited_times),
  }));
  return { window, registrations: rows, fetchedAt };
}

/** Invites sent in the 12 weeks up to 14 days ago, and how many were accepted within 14 days. */
export async function loadInvites(ctx: DashboardContext, v: V2Context) {
  const to = addDays(v.today, -(INVITE_DAYS - 1));
  const from = addDays(to, -7 * 12);
  const { records, fetchedAt } = await run(ctx, "invites", invites(v.people), {
    from: dt(from),
    to: dt(to),
    end: end(v),
  });
  return {
    from,
    to: addDays(to, -1),
    sent: num(records[0]?.sent),
    accepted: num(records[0]?.accepted),
    fetchedAt,
  };
}

/** Requests with at least one answer, by the week sent; null before answers carried the request id. */
export async function loadRequests(ctx: DashboardContext, v: V2Context) {
  const started = ANSWERS_STARTED[v.env];
  const { records, fetchedAt } = await run(ctx, "requests", requests(v.people), {
    start: later(dt(v.period.start), started),
    end: end(v),
  });
  const count = (key: string) =>
    perWeek(v, records, (week, r) => (tracked(week, started) ? num(r[key]) : null));
  return { answered: count("answered"), resolved: count("resolved"), fetchedAt };
}

/**
 * Citable knowledge and how much was cited in the last 30 days; the people who
 * created it and how many had some cited in the last 90 (today included).
 */
export async function loadReuse(ctx: DashboardContext, v: V2Context) {
  const { records, fetchedAt } = await run(ctx, "reuse", reuse(v.people), {
    history_start: HISTORY_START,
    end: end(v),
    cited_from: dt(addDays(v.today, -29)),
    authors_from: dt(addDays(v.today, -89)),
  });
  const r = records[0] ?? {};
  return {
    available: num(r.available),
    cited: num(r.cited_available),
    authors: num(r.cited_authors),
    contributors: num(r.authors),
    fetchedAt,
  };
}
