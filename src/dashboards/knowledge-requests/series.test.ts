import { describe, expect, it } from "vitest";

import type { RequestRow } from "./lifecycle";
import { dailyGaps, dailyRequests, gapTotals } from "./series";

const DATES = ["2026-10-26", "2026-10-27", "2026-10-28"];

function req(sentDay: string, extra: Partial<RequestRow> = {}): RequestRow {
  return {
    request: sentDay,
    sentAt: 0,
    sentDay,
    assignedTo: "",
    opened: null,
    ignored: false,
    answers: [],
    rejections: [],
    close: null,
    suggestions: { made: [], accepted: [], declined: [] },
    ...extra,
  };
}

const answered = { answers: [{ at: 1, secondsOpen: 1, role: "" }] };

describe("dailyRequests", () => {
  it("groups by the day each request was sent, so the days add up to the totals", () => {
    const rows = [
      req("2026-10-26", { ...answered, close: { at: 2, outcome: "resolved", secondsOpen: 2 } }),
      req("2026-10-28", answered),
      req("2026-10-28", { close: { at: 2, outcome: "cancelled", secondsOpen: 2 } }),
      req("2026-10-20"), // outside the counted days
    ];
    expect(dailyRequests(DATES, rows)).toEqual({
      sent: [1, 0, 2],
      answered: [1, 0, 1],
      resolved: [1, 0, 0],
    });
  });
});

describe("dailyGaps", () => {
  it("fills every counted day and sums the totals", () => {
    const days = [
      { day: "2026-10-26", detected: 2, linked: 2, sent: 1 },
      { day: "2026-10-28", detected: 8, linked: 8, sent: 5 },
    ];
    expect(dailyGaps(DATES, days)).toEqual({ detected: [2, 0, 8], sent: [1, 0, 5] });
    expect(gapTotals(days)).toEqual({ detected: 10, linked: 10, sent: 6 });
    expect(gapTotals([])).toEqual({ detected: 0, linked: 0, sent: 0 });
  });
});
