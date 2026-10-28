// The one plain sentence that opens each section, generated from the data.

import { formatNumber } from "@/components/charts/scale";
import { formatDayMonth, type ISODate } from "@/lib/dates";

import { IGNORE_DAYS, TRACKED, type DataKey } from "./config";
import { formatDuration, type FunnelCounts } from "./lifecycle";
import type { TrackingStart } from "./tracking";

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

const was = (count: number) => (count === 1 ? "was" : "were");

/** Every sentence's opening: the range, or the tracking start when the range reaches back before it. */
export interface Span {
  days: number;
  since?: ISODate | null;
}

export function periodPhrase({ days, since }: Span): string {
  return since
    ? `Since the new request tracking started on ${formatDayMonth(since)}`
    : `In the last ${days} days`;
}

/** "a, b and c" */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** "answers and closings aren’t tracked in this project yet" */
export function notTrackedYet(keys: DataKey[]): string {
  const nouns = [...new Set(keys.map((k) => TRACKED[k].noun))];
  return `${listJoin(nouns)} aren’t tracked in this project yet`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Says which data first appeared inside the range, and what that means: for
 * events, anything before that day wasn't recorded, so numbers read low until
 * the day is out of the range. Null when everything was tracked all along.
 */
export function trackingNote(starts: TrackingStart[]): string | null {
  const at = (s: TrackingStart) => `${TRACKED[s.key].since} on ${formatDayMonth(s.date)}`;
  const events = starts.filter((s) => s.key !== "gapLink" && s.key !== "assignedTo" && s.key !== "sent");
  const parts: string[] = [];
  if (events.length > 0) {
    parts.push(
      `${capitalise(listJoin(events.map(at)))}. Anything that happened before then wasn’t recorded, so these numbers can read low until ${events.length === 1 ? "that day is" : "those days are"} out of the range.`,
    );
  }
  for (const s of starts) {
    if (s.key === "assignedTo")
      parts.push(`${capitalise(at(s))}, so requests sent before then aren’t in that comparison.`);
    if (s.key === "gapLink")
      parts.push(`${capitalise(at(s))}, so only gaps detected since then can be matched to a request.`);
    if (s.key === "sent") parts.push(`${capitalise(at(s))}, so requests sent before then aren’t counted.`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

/** For a section whose data hasn't appeared at all. */
export function waitingSentence(keys: DataKey[]): string {
  return `${capitalise(notTrackedYet(keys))}, so this section has nothing to show yet.`;
}

/** "the 3 of the 5 …" style: "3 of 5", "all 5", "none of the 5", "the one … was". */
function ofTotal(part: number, total: number): string {
  if (part === total) return total === 1 ? "the one" : `all ${formatNumber(total)}`;
  if (part === 0) return `none of the ${formatNumber(total)}`;
  return `${formatNumber(part)} of the ${formatNumber(total)}`;
}

export function overviewSentence(
  input: Span & {
    funnel: FunnelCounts;
    /** Funnel steps that are tracked; the others are waiting. */
    steps: { answered: boolean; resolved: boolean };
    waiting: DataKey[];
  },
): string {
  const { funnel, steps, waiting } = input;
  const period = periodPhrase(input);
  const rest = waiting.length > 0 ? `; ${notTrackedYet(waiting)}` : "";
  if (funnel.sent === 0) return `${period}, no requests were sent${rest}.`;
  const sent = `${plural(funnel.sent, "request")} ${was(funnel.sent)} sent`;
  const parts = [`assignees opened ${formatNumber(funnel.opened)}`];
  if (steps.answered) parts.push(`${formatNumber(funnel.answered)} ${was(funnel.answered)} answered`);
  if (steps.resolved) parts.push(`${formatNumber(funnel.resolved)} resolved`);
  return `${period}, ${sent}: ${listJoin(parts)}${rest}.`;
}

export function gapsSentence(
  input: Span & {
    /** Every gap in the range. */
    detected: number;
    /** Gaps carrying their request's id, so they can be matched. */
    linked: number;
    sent: number;
    tracked: boolean;
    /** The day gaps started carrying the id, when that is inside the range. */
    linkedSince?: ISODate | null;
  },
): string {
  const { detected, linked, sent, tracked, linkedSince } = input;
  const period = periodPhrase(input);
  if (!tracked) {
    const found = detected === 0 ? "the AI detected no gaps" : `the AI detected ${plural(detected, "gap")}`;
    return `${period}, ${found}; ${notTrackedYet(["gapLink"])}, so it can’t tell which became requests.`;
  }
  const unmatched = Math.max(0, detected - linked);
  if (unmatched === 0) {
    if (linked === 0) return `${period}, the AI detected no gaps.`;
    if (linked === 1)
      return `${period}, the one gap the AI detected ${sent > 0 ? "was" : "wasn’t"} sent as a request.`;
    return `${period}, ${ofTotal(sent, linked)} gaps the AI detected ${was(sent)} sent as a request.`;
  }
  const unsent = linked - sent;
  const parts = [
    sent === 0 ? "none were sent as a request" : `${formatNumber(sent)} ${was(sent)} sent as a request`,
    ...(unsent > 0 ? [`${formatNumber(unsent)} ${unsent === 1 ? "wasn’t" : "weren’t"}`] : []),
    `${formatNumber(unmatched)} can’t be matched to a request${linkedSince ? ` (detected before ${formatDayMonth(linkedSince)})` : ""}`,
  ];
  return `${period}, the AI detected ${plural(detected, "gap")}: ${listJoin(parts)}.`;
}

export function routingSentence(
  input: Span & { requests: number; opened: number; medianToOpen: number | null; ignored: number },
): string {
  const { requests, opened, medianToOpen, ignored } = input;
  const period = periodPhrase(input);
  if (requests === 0) return `${period}, no requests were sent.`;
  if (requests === 1) {
    const state =
      opened > 0
        ? "was opened by an assignee"
        : ignored > 0
          ? `went unopened for ${IGNORE_DAYS} days`
          : "hasn’t been opened yet";
    return `${period}, the one request sent ${state}.`;
  }
  const half =
    opened > 1 && medianToOpen !== null ? `, half of them within ${formatDuration(medianToOpen)}` : "";
  const unopened =
    ignored === 0
      ? `none went unopened for ${IGNORE_DAYS} days`
      : `${formatNumber(ignored)} went unopened for ${IGNORE_DAYS} days`;
  return `${period}, assignees opened ${ofTotal(opened, requests)} requests sent${half}; ${unopened}.`;
}

export function answersSentence(
  input: Span & {
    answers: { requests: number; answered: number; medianToFirst: number | null } | null;
    suggestions: { made: number; withSuggestions: number; accepted: number; declined: number } | null;
  },
): string {
  const { answers, suggestions } = input;
  const period = periodPhrase(input);
  if (answers) {
    if (answers.requests === 0) return `${period}, no requests were sent.`;
    if (answers.answered === 0) {
      return answers.requests === 1
        ? `${period}, the one request sent hasn’t been answered.`
        : `${period}, none of the ${formatNumber(answers.requests)} requests sent got an answer.`;
    }
    const first =
      answers.medianToFirst === null
        ? ""
        : `, the first after ${answers.answered === 1 ? "" : "a median of "}${formatDuration(answers.medianToFirst)}`;
    return `${period}, ${ofTotal(answers.answered, answers.requests)} ${answers.requests === 1 ? "request" : "requests"} sent got an answer${first}.`;
  }
  const waiting = capitalise(notTrackedYet(["answered"]));
  if (!suggestions || suggestions.made === 0) {
    return suggestions ? `${period}, the AI suggested no answers. ${waiting}.` : `${waiting}.`;
  }
  const reviewed = suggestions.accepted + suggestions.declined;
  const verdict =
    reviewed === 0
      ? "requesters haven’t reviewed any yet"
      : `requesters accepted ${ofTotal(suggestions.accepted, reviewed)} they reviewed`;
  return `${period}, the AI suggested ${plural(suggestions.made, "answer")} for ${plural(suggestions.withSuggestions, "request")}; ${verdict}. Human ${notTrackedYet(["answered"])}.`;
}

export function closingSentence(
  input: Span & {
    requests: number;
    resolved: number;
    cancelled: number;
    /** Null when answers aren't tracked, so open requests can't be split. */
    openAnswered: number | null;
  },
): string {
  const { requests, resolved, cancelled, openAnswered } = input;
  const period = periodPhrase(input);
  if (requests === 0) return `${period}, no requests were sent.`;
  if (requests === 1) {
    const state = resolved > 0 ? "was resolved" : cancelled > 0 ? "was cancelled" : "hasn’t been closed";
    return `${period}, the one request sent ${state}.`;
  }
  const closed =
    resolved + cancelled === 0
      ? `none of the ${plural(requests, "request")} sent ${requests === 1 ? "has" : "have"} been closed`
      : resolved === 0
        ? `none of the ${plural(requests, "request")} sent were resolved; ${formatNumber(cancelled)} ${was(cancelled)} cancelled`
        : `${formatNumber(resolved)} of the ${plural(requests, "request")} sent ${was(resolved)} resolved and ${formatNumber(cancelled)} cancelled`;
  const open =
    openAnswered === null || openAnswered === 0
      ? ""
      : `; ${formatNumber(openAnswered)} ${openAnswered === 1 ? "has answers but is" : "have answers but are"} still open`;
  return `${period}, ${closed}${open}.`;
}
