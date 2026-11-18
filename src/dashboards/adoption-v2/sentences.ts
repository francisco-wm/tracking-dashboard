// The one plain sentence that opens each section, and tile captions, generated from the data.

import { formatNumber, type NumberFormat } from "@/components/charts/scale";
import { formatDayMonth, type ISODate } from "@/lib/dates";

import { plural } from "../adoption/sentences";
import type { Headline, Stage } from "./logic";

const people = (count: number) => plural(count, "person", "people");

/** "4-week average 15.5, up 12% on the 4 weeks before". */
export function averageCaption(h: Headline, format: NumberFormat = "int"): string {
  if (h.average === null) return "Not enough weeks yet for a 4-week average";
  const average = `4-week average ${formatNumber(h.average, format === "int" ? "decimal" : format)}`;
  if (h.change === null) return average;
  if (Math.abs(h.change) < 0.005) return `${average}, the same as the 4 weeks before`;
  return `${average}, ${h.change > 0 ? "up" : "down"} ${formatNumber(Math.abs(h.change), "percent")} on the 4 weeks before`;
}

export function headlineSentence(input: {
  week: ISODate;
  active: number;
  questions: number | null;
  sourced: number | null;
}): string {
  const { week, active, questions, sourced } = input;
  const when = `In the week of ${formatDayMonth(week)}`;
  if (active === 0) return `Nobody took a core action in the week of ${formatDayMonth(week)}.`;
  const main = `${when}, ${people(active)} took a core action`;
  if (questions === null || sourced === null) return `${main}.`;
  if (questions === 0) return `${main}, and nobody sent a chat message.`;
  return `${main}, and ${formatNumber(sourced)} of ${plural(questions, "chat message")} got a sourced answer.`;
}

export function accountsSentence(input: {
  total: number;
  active: number;
  red: number;
  amber: number;
  green: number;
}): string {
  const { total, active, red, amber, green } = input;
  if (total === 0) return "There are no organisations yet.";
  return `${formatNumber(active)} of ${plural(total, "organisation")} had an active person last week: ${formatNumber(green)} green, ${formatNumber(amber)} amber and ${formatNumber(red)} red.`;
}

export function activationSentence(input: {
  ready: boolean;
  firstReady: ISODate;
  citationsDay: ISODate;
  stages: Stage[];
}): string {
  const { ready, firstReady, citationsDay, stages } = input;
  if (!ready) {
    return `The funnel starts on ${formatDayMonth(firstReady)}, when the first people who registered after citation tracking began (${formatDayMonth(citationsDay)}) have had their 28 days.`;
  }
  const registered = stages[0].people;
  const aha = stages[2].people;
  if (registered === 0) return "Nobody registered in the weeks the funnel follows.";
  return `${formatNumber(aha)} of the ${people(registered)} who registered got a sourced answer within their first 14 days.`;
}

export function retentionSentence(input: {
  week1: { active: number; size: number };
  week4: { active: number; size: number };
}): string {
  const { week1, week4 } = input;
  if (week1.size === 0) return "Nobody who registered in the last 16 weeks has had a full week since.";
  const pct = (r: { active: number; size: number }) => formatNumber(r.active / r.size, "percent");
  const first = `${pct(week1)} of people were active again in the week after they registered`;
  if (week4.size === 0) return `${first}; nobody has reached week 4 yet.`;
  return `${first}, and ${pct(week4)} in their fourth week.`;
}

export function loopSentence(input: {
  week: ISODate;
  /** New listings and re-listed edits. */
  listed: number;
  uploads: number;
  questions: number;
  sourced: number | null;
}): string {
  const { week, listed, uploads, questions, sourced } = input;
  const when = `In the week of ${formatDayMonth(week)}`;
  const supply = `${plural(listed, "fragment")} ${listed === 1 ? "was" : "were"} listed and ${plural(uploads, "file")} uploaded`;
  if (sourced === null || questions === 0) {
    return `${when}, ${supply}, and ${plural(questions, "chat message")} ${questions === 1 ? "was" : "were"} sent.`;
  }
  return `${when}, ${supply}; ${formatNumber(sourced)} of ${plural(questions, "chat message")} got a sourced answer.`;
}
