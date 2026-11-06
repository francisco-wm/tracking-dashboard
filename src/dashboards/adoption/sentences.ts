// The one plain sentence that opens each section, generated from the data.

import { formatNumber } from "@/components/charts/scale";
import { formatDayMonth, type ISODate } from "@/lib/dates";

import { PER_PEOPLE } from "./config";
import { perActive, share } from "./filters";
import type { ReturnSummary } from "./returns";

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

const people = (count: number) => plural(count, "person", "people");

/** "8 more than 4 weeks before", for a tile caption. */
export function changePhrase(now: number, before: number): string {
  if (now === before) return "Same as 4 weeks before";
  const diff = Math.abs(now - before);
  return `${formatNumber(diff)} ${now > before ? "more" : "fewer"} than 4 weeks before`;
}

export function activeSentence(input: { week: ISODate; active: number; fourWeeksBefore: number }): string {
  const { week, active, fourWeeksBefore } = input;
  const when = `In the week of ${formatDayMonth(week)}`;
  const before = formatNumber(fourWeeksBefore);
  if (active === 0) {
    return fourWeeksBefore === 0
      ? `Nobody used wingmaite in the week of ${formatDayMonth(week)}, nor four weeks before.`
      : `Nobody used wingmaite in the week of ${formatDayMonth(week)}, down from ${before} four weeks before.`;
  }
  const main = `${when}, ${people(active)} used wingmaite`;
  if (active === fourWeeksBefore) return `${main}, the same as four weeks before.`;
  return `${main}, ${active > fourWeeksBefore ? "up" : "down"} from ${before} four weeks before.`;
}

export function returnSentence(input: { summary: ReturnSummary; start: ISODate; weeks: number }): string {
  const { summary, start, weeks } = input;
  const { started, counted, returned, stillOpen, countedUntil } = summary;
  if (started === 0) return `Nobody started using wingmaite in the last ${weeks} weeks.`;
  if (counted === 0 || countedUntil === null) {
    return `${stillOpen === 1 ? "One person" : `${formatNumber(stillOpen)} people`} started using wingmaite in the last ${weeks} weeks, but nobody has had four weeks yet to come back.`;
  }
  const rate = formatNumber(share(returned, counted) ?? 0, "percent");
  return `${rate} of the people who started using wingmaite between ${formatDayMonth(start)} and ${formatDayMonth(countedUntil)} came back after their first two weeks: ${formatNumber(returned)} of ${formatNumber(counted)}.`;
}

export function activitySentence(input: {
  week: ISODate;
  active: number;
  created: number;
  answered: number;
}): string {
  const { week, active, created, answered } = input;
  const when = `In the week of ${formatDayMonth(week)}`;
  if (active === 0) return `Nobody used wingmaite in the week of ${formatDayMonth(week)}.`;
  const who = `${people(active)} ${active === 1 ? "was" : "were"} active`;
  if (created === 0 && answered === 0)
    return `${when}, ${who} and no knowledge requests were created or answered.`;
  const per = (count: number) => formatNumber(perActive(count, active) ?? 0, "decimal");
  return `${when}, ${who}, and ${plural(created, "knowledge request")} ${created === 1 ? "was" : "were"} created and ${formatNumber(answered)} answered: ${per(created)} and ${per(answered)} per ${PER_PEOPLE} active people.`;
}

export function orgsSentence(input: {
  week: ISODate;
  active: number;
  total: number;
  newOrgs: number;
  weeks: number;
}): string {
  const { week, active, total, newOrgs, weeks } = input;
  if (total === 0) return `No organisation had an active person in the last ${weeks} weeks.`;
  const lastWeek =
    active === 0
      ? `No organisation had an active person in the week of ${formatDayMonth(week)}`
      : `In the week of ${formatDayMonth(week)}, ${plural(active, "organisation")} had at least one active person`;
  const fresh = newOrgs === 0 ? "none of them new" : `${formatNumber(newOrgs)} of them for the first time`;
  return `${lastWeek}; ${formatNumber(total)} did in the last ${weeks} weeks, ${fresh}.`;
}
