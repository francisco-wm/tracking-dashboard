// The one plain sentence that opens each section, generated from the data.

import { formatNumber } from "@/components/charts/scale";
import { formatDayMonth, type ISODate } from "@/lib/dates";

import { WINDOW_DAYS } from "./windows";

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

/** "On send day" / "In the first 5 days after the send" / "In the 14 days after the send" */
export function afterPeriod(daysElapsed: number): string {
  if (daysElapsed <= 1) return "On send day";
  if (daysElapsed >= WINDOW_DAYS) return `In the ${WINDOW_DAYS} days after the send`;
  return `In the first ${daysElapsed} days after the send`;
}

/** "up from 16 in the same days before" / "the same as on the matching day before" */
export function versusBefore(after: number, before: number, daysElapsed: number): string {
  const when = daysElapsed <= 1 ? "on the matching day before" : "in the same days before";
  if (after === before) return `the same as ${when}`;
  return `${after > before ? "up" : "down"} from ${formatNumber(before)} ${when}`;
}

export function reachSentence(input: { send: ISODate; clickers: number; activeSinceSend: number }): string {
  const send = formatDayMonth(input.send);
  if (input.clickers === 0) {
    return `Nobody has clicked “Share your knowledge” since the ${send} send yet.`;
  }
  const verb = input.clickers === 1 ? "person has" : "people have";
  const share =
    input.activeSinceSend > 0
      ? `: ${formatNumber(input.clickers / input.activeSinceSend, "percent")} of the ${plural(input.activeSinceSend, "person", "people")} active since then`
      : "";
  return `${formatNumber(input.clickers)} ${verb} clicked “Share your knowledge” since the ${send} send${share}.`;
}

export function questionsSentence(input: { daysElapsed: number; after: number; before: number }): string {
  const { daysElapsed, after, before } = input;
  return `${afterPeriod(daysElapsed)}, people asked ${plural(after, "question")}, ${versusBefore(after, before, daysElapsed)}.`;
}

export function contributingSentence(input: {
  daysElapsed: number;
  after: number;
  before: number;
  firstTimeCreators: number;
}): string {
  const { daysElapsed, after, before, firstTimeCreators } = input;
  const listed = after === 1 ? "piece of knowledge was" : "pieces of knowledge were";
  const creators =
    firstTimeCreators > 0
      ? `; ${plural(firstTimeCreators, "person", "people")} listed for the first time`
      : "";
  return `${afterPeriod(daysElapsed)}, ${formatNumber(after)} ${listed} newly listed, ${versusBefore(after, before, daysElapsed)}${creators}.`;
}

export function comingBackSentence(input: {
  cameBack: number;
  /** Average of the full weeks before the send week; null when there are none. */
  typical: number | null;
  sendWeekInProgress: boolean;
}): string {
  const { cameBack, typical, sendWeekInProgress } = input;
  const when = sendWeekInProgress ? "So far in the send week" : "In the send week";
  const who = `${plural(cameBack, "person", "people")} came back after a break`;
  if (typical === null) return `${when}, ${who}.`;
  return `${when}, ${who}, against ${formatNumber(typical, Number.isInteger(typical) ? "int" : "decimal")} in a typical week before it.`;
}

export function clickersSentence(input: {
  clickers: number;
  actedWithin24h: number;
  contributedWithin7d: number;
}): string {
  const { clickers, actedWithin24h, contributedWithin7d } = input;
  if (clickers === 0) return "Nobody has clicked yet, so there is no one to follow.";
  return `Of ${plural(clickers, "clicker")}, ${formatNumber(actedWithin24h)} asked or contributed within 24 hours and ${formatNumber(contributedWithin7d)} contributed within 7 days.`;
}
