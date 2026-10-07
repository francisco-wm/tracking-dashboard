// The one plain sentence that opens each section, generated from the data.

import { formatNumber } from "@/components/charts/scale";

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
  /** Edits, not fragments: a fragment edited twice counts twice. */
  started: number;
  listed: number;
  /** Not listed yet, but still inside the completion window. */
  stillInDraft: number;
}): string {
  const { days, started, listed, stillInDraft } = input;
  const period = periodPhrase(days);
  const rate = completionRate(listed, started);
  if (rate === null) return `${period}, nobody started editing a listed fragment.`;
  const main = `${period}, ${formatNumber(rate, "percent")} of edits started were listed: ${formatNumber(listed)} of ${formatNumber(started)}`;
  return `${main}${draftClause(started - listed, stillInDraft)}.`;
}

/** "; the other 2 are still in draft" */
function draftClause(rest: number, stillInDraft: number): string {
  if (stillInDraft === 0) return "";
  if (stillInDraft === rest) {
    return rest === 1
      ? "; the other one is still in draft"
      : `; the other ${formatNumber(rest)} are still in draft`;
  }
  return `; ${formatNumber(stillInDraft)} of the other ${formatNumber(rest)} ${stillInDraft === 1 ? "is" : "are"} still in draft`;
}
