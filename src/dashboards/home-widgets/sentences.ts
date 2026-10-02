// The one plain sentence that opens each section, generated from the data.

import { formatNumber } from "@/components/charts/scale";
import { formatDayMonth, type ISODate } from "@/lib/dates";

import { FOLLOW_WINDOW_DAYS } from "./config";

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

/** Every sentence's opening: the range, or the tracking start when the range reaches back before it. */
interface Span {
  days: number;
  /** Set when counting starts at the tracking start, not at the range's first day. */
  since?: ISODate | null;
}

export function periodPhrase({ days, since }: Span): string {
  return since ? `Since widget tracking started on ${formatDayMonth(since)}` : `In the last ${days} days`;
}

/** "13 of the 71 people who opened the home page" */
function clickersOfVisitors(clickers: number, visitors: number): string {
  if (visitors === 0 || clickers > visitors) return plural(clickers, "person", "people");
  if (visitors === 1) return "the one person who opened the home page";
  if (clickers === visitors) return `all ${formatNumber(visitors)} people who opened the home page`;
  return `${formatNumber(clickers)} of the ${formatNumber(visitors)} people who opened the home page`;
}

export function interactionsSentence(
  input: Span & {
    homePeople: number;
    clickers: number;
    clicks: number;
    widgets: { label: string; clicks: number }[];
  },
): string {
  const { homePeople, clickers, clicks, widgets } = input;
  const period = periodPhrase(input);
  if (clicks === 0) {
    if (homePeople === 0) return `${period}, nobody opened the home page.`;
    const opened = `${plural(homePeople, "person", "people")} opened the home page`;
    return `${period}, ${opened} and nobody clicked anything in its widgets.`;
  }
  const clicked = widgets.filter((w) => w.clicks > 0).sort((a, b) => b.clicks - a.clicks);
  let where = "";
  if (clicked.length === 1) where = `, all in ${clicked[0].label}`;
  else if (clicked.length > 1 && clicked[0].clicks > clicked[1].clicks)
    where = `, most in ${clicked[0].label}`;
  return `${period}, ${clickersOfVisitors(clickers, homePeople)} clicked a widget item, ${plural(clicks, "click")} in all${where}.`;
}

/** "1 of the 14 drafts … was listed", "none of the 2 … were listed" */
export function listedOf(listed: number, total: number, one: string, many: string): string {
  if (total === 1) return `the one ${one} ${listed > 0 ? "was" : "wasn’t"} listed`;
  if (listed === 0) return `none of the ${formatNumber(total)} ${many} were listed`;
  if (listed === total) return `all ${formatNumber(total)} ${many} were listed`;
  return `${formatNumber(listed)} of the ${formatNumber(total)} ${many} ${listed === 1 ? "was" : "were"} listed`;
}

export function followThroughSentence(
  input: Span & {
    opened: { drafts: number; listed: number };
    started: { drafts: number; listed: number };
  },
): string {
  const { opened, started } = input;
  const period = periodPhrase(input);
  if (opened.drafts === 0 && started.drafts === 0) {
    return `${period}, no drafts were opened or started from the drafts widget.`;
  }
  const openedPart =
    opened.drafts === 0
      ? "no drafts were opened from the drafts widget"
      : `${listedOf(opened.listed, opened.drafts, "draft opened from the drafts widget", "drafts opened from the drafts widget")} within ${FOLLOW_WINDOW_DAYS} days`;
  const startedPart =
    started.drafts === 0
      ? "no new drafts were started there"
      : listedOf(started.listed, started.drafts, "new draft started there", "new drafts started there");
  return `${period}, ${openedPart}; ${startedPart}.`;
}

export function reliabilitySentence(
  input: Span & {
    failures: number;
    /** People who saw at least one widget fail. */
    people: number;
    retries: number;
    retriesWorked: number;
  },
): string {
  const { failures, people, retries, retriesWorked } = input;
  const period = periodPhrase(input);
  if (failures === 0) {
    if (retries === 0) return `${period}, no widget failed to load.`;
    const recorded = retries === 1 ? "a retry was" : `${formatNumber(retries)} retries were`;
    return `${period}, no failed loads were recorded, but ${recorded}.`;
  }
  const failed =
    failures === 1
      ? "a widget failed to load once"
      : `widgets failed to load ${formatNumber(failures)} times`;
  let retried: string;
  if (retries === 0) retried = "nobody retried";
  else if (retries === 1) retried = retriesWorked > 0 ? "the one retry worked" : "the one retry didn’t work";
  else retried = `${formatNumber(retriesWorked)} of ${formatNumber(retries)} retries worked`;
  return `${period}, ${failed} for ${plural(people, "person", "people")}; ${retried}.`;
}
