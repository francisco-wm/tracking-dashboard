// The one plain sentence that opens each section, generated from the data.

import { formatNumber } from "@/components/charts/scale";

import { COMPLETION_WINDOW_DAYS } from "./config";
import { completionRate } from "./filters";

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

export function periodPhrase(days: number): string {
  return `In the last ${days} days`;
}

export function editsListedSentence(input: { days: number; fragments: number; newListings: number }): string {
  const { days, fragments, newListings } = input;
  const period = periodPhrase(days);
  if (fragments === 0 && newListings === 0) return `${period}, nothing new or edited was listed.`;
  const fresh = `${plural(newListings, "new piece")} of knowledge`;
  if (fragments === 0) return `${period}, no edits were listed, next to ${fresh}.`;
  const edits = `edits to ${plural(fragments, "fragment")} were listed`;
  if (newListings === 0) return `${period}, ${edits} and no new knowledge was.`;
  return `${period}, ${edits}, next to ${fresh}.`;
}

export function completionSentence(input: {
  days: number;
  started: number;
  listed: number;
  /** Not listed yet, but still inside the completion window. */
  stillOpen: number;
}): string {
  const { days, started, listed, stillOpen } = input;
  const period = periodPhrase(days);
  const rate = completionRate(listed, started);
  if (rate === null) return `${period}, nobody started editing a listed fragment.`;
  const main = `${period}, ${formatNumber(rate, "percent")} of edited fragments had their changes listed: ${formatNumber(listed)} of ${formatNumber(started)}`;
  return `${main}${openClause(started - listed, stillOpen)}.`;
}

/** "; the other 2 were started in the last 30 days and can still be listed" */
function openClause(rest: number, stillOpen: number): string {
  if (stillOpen === 0) return "";
  const tail = `started in the last ${COMPLETION_WINDOW_DAYS} days and can still be listed`;
  if (stillOpen === rest) {
    return rest === 1 ? `; the other one was ${tail}` : `; the other ${formatNumber(rest)} were ${tail}`;
  }
  return `; ${formatNumber(stillOpen)} of the other ${formatNumber(rest)} ${stillOpen === 1 ? "was" : "were"} ${tail}`;
}
