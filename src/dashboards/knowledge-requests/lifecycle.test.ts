import { describe, expect, it } from "vitest";

import {
  requestsByAssignment,
  answerSummary,
  closingSummary,
  formatDuration,
  funnelCounts,
  median,
  parseRequest,
  rejectionSummary,
  seenBucket,
  seenSummary,
  suggestionSummary,
  type RequestRow,
} from "./lifecycle";

const DAY = 86_400;
const NOW = 1_793_200_000; // 28 Oct 2026, 13:46 UTC

/** A request sent `daysAgo` before NOW, with nothing else unless given. */
function req(daysAgo: number, extra: Partial<RequestRow> = {}): RequestRow {
  const sentAt = NOW - daysAgo * DAY;
  return {
    request: `r${daysAgo}`,
    sentAt,
    sentDay: new Date(sentAt * 1000).toISOString().slice(0, 10),
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

const answer = (row: RequestRow, afterSeconds: number, role = "direct_assignee") => ({
  at: row.sentAt + afterSeconds,
  secondsOpen: afterSeconds,
  role,
});

describe("median", () => {
  it("takes the middle value, or the mean of the two middle values", () => {
    expect(median([])).toBeNull();
    expect(median([5])).toBe(5);
    expect(median([9, 1, 5])).toBe(5);
    expect(median([1, 2, 3, 100])).toBe(2.5);
  });
});

describe("parseRequest", () => {
  it("reads the query's arrays and tuples, in time order", () => {
    const row = parseRequest({
      request: "c8aae691",
      sent_at: 1793188457,
      assigned_to: "users",
      opened: [[1793188463, 5.0]],
      ignored: [],
      answers: [
        [1793190000, 1543, "team_member"],
        [1793189000, 543, ""],
      ],
      rejections: [
        [1793189320, "dont_know", 1],
        [1793188877, "needs_more_info", 0],
      ],
      closes: [[1793191712, "cancelled", 3255.0]],
      suggested: ["f1"],
      accepted: [],
      declined: ["f1"],
    });
    expect(row.sentDay).toBe("2026-10-28");
    expect(row.opened).toEqual({ at: 1793188463, sinceAssigned: 5 });
    expect(row.answers.map((a) => a.role)).toEqual(["", "team_member"]);
    expect(row.rejections.map((r) => [r.reason, r.reassigned])).toEqual([
      ["needs_more_info", false],
      ["dont_know", true],
    ]);
    expect(row.close).toEqual({ at: 1793191712, outcome: "cancelled", secondsOpen: 3255 });
    expect(row.ignored).toBe(false);
  });

  it("copes with empty sides of the joins", () => {
    const row = parseRequest({ request: "x", sent_at: 1793188457, assigned_to: "" });
    expect(row.opened).toBeNull();
    expect(row.answers).toEqual([]);
    expect(row.close).toBeNull();
    expect(row.suggestions).toEqual({ made: [], accepted: [], declined: [] });
  });
});

describe("funnelCounts", () => {
  it("never lets a step exceed the one before it, and counts the skips apart", () => {
    const opened = { at: 0, sinceAssigned: 60 };
    const a = req(20, { opened });
    a.answers = [answer(a, 3600)];
    a.close = { at: a.sentAt + 7200, outcome: "resolved", secondsOpen: 7200 };
    const b = req(19, { opened });
    const c = req(18);
    c.answers = [answer(c, 600, "requester")];
    const d = req(17, { close: { at: 0, outcome: "resolved", secondsOpen: 100 } });
    expect(funnelCounts([a, b, c, d])).toEqual({
      sent: 4,
      opened: 2,
      answered: 1,
      resolved: 1,
      answeredUnopened: 1,
      resolvedUnanswered: 1,
    });
  });

  it("goes straight from opened to resolved while answers aren't tracked", () => {
    const a = req(20, { opened: { at: 0, sinceAssigned: 60 } });
    a.close = { at: 0, outcome: "resolved", secondsOpen: 100 };
    expect(funnelCounts([a], false).resolved).toBe(1);
    expect(funnelCounts([a]).resolved).toBe(0);
  });
});

describe("seen", () => {
  it("sorts requests by whether and when they were opened", () => {
    const inTime = req(20, {
      opened: { at: NOW - 20 * DAY + 3600, sinceAssigned: 3600 },
    });
    const late = req(20, {
      opened: { at: NOW - 10 * DAY, sinceAssigned: 10 * DAY },
      ignored: true,
    });
    const never = req(9, { ignored: true });
    const closedFirst = req(9);
    const recent = req(3);
    expect(seenBucket(inTime, NOW)).toBe("openedInTime");
    expect(seenBucket(late, NOW)).toBe("openedLate");
    expect(seenBucket(never, NOW)).toBe("notOpened");
    expect(seenBucket(closedFirst, NOW)).toBe("closedUnopened");
    expect(seenBucket(recent, NOW)).toBe("tooRecent");

    const summary = seenSummary([inTime, late, never, closedFirst, recent], NOW);
    expect(summary.opened).toBe(2);
    expect(summary.medianToOpen).toBe((3600 + 10 * DAY) / 2);
    expect(summary.oldEnough).toBe(4);
    expect(summary.ignored).toBe(2);
  });
});

describe("rejectionSummary", () => {
  it("counts every rejection by reason and follows the passed-on ones to an answer", () => {
    const a = req(5);
    a.rejections = [
      { at: a.sentAt + 100, reason: "dont_know", reassigned: true },
      { at: a.sentAt + 200, reason: "dont_know", reassigned: false },
    ];
    a.answers = [answer(a, 150)];
    const b = req(4);
    b.rejections = [{ at: b.sentAt + 100, reason: "", reassigned: true }];
    b.answers = [answer(b, 50)]; // before the rejection: doesn't count
    const s = rejectionSummary([a, b, req(3)]);
    expect(s.total).toBe(3);
    expect(s.requests).toBe(2);
    expect(s.passedOn).toBe(2);
    expect(s.passedOnAnswered).toBe(1);
    expect(s.byReason[0]).toEqual({ key: "dont_know", label: "Doesn’t know the answer", count: 2 });
    expect(s.byReason.find((r) => r.key === "")?.count).toBe(1);
    // Every known reason is listed, so a zero reads as "none".
    expect(s.byReason.find((r) => r.key === "duplicate")?.count).toBe(0);
  });

  it("keeps a reason it doesn't know, under its raw value", () => {
    const a = req(5, { rejections: [{ at: 0, reason: "too_busy", reassigned: false }] });
    expect(rejectionSummary([a]).byReason[0]).toMatchObject({ key: "too_busy", label: "too_busy", count: 1 });
  });
});

describe("requestsByAssignment", () => {
  it("counts requests and answers for people, both and teams, and leaves untracked requests out", () => {
    const users = req(5, { assignedTo: "users" });
    users.answers = [answer(users, 10)];
    const rates = requestsByAssignment([
      users,
      req(4, { assignedTo: "users" }),
      req(3, { assignedTo: "teams" }),
      req(2),
    ]);
    expect(rates.map((r) => [r.assignedTo, r.requests, r.answered])).toEqual([
      ["users", 2, 1],
      ["both", 0, 0],
      ["teams", 1, 0],
    ]);
  });
});

describe("answerSummary", () => {
  it("measures the first answer and counts answers per request and role", () => {
    const a = req(5);
    a.answers = [answer(a, 100), answer(a, 500, "team_member")];
    const b = req(4);
    b.answers = [answer(b, 300, "")];
    const c = req(3);
    c.answers = [answer(c, 900), answer(c, 1000), answer(c, 2000, "requester")];
    const s = answerSummary([a, b, c, req(2)]);
    expect(s.requests).toBe(4);
    expect(s.answered).toBe(3);
    expect(s.answers).toBe(6);
    expect(s.medianToFirst).toBe(300);
    expect(s.perRequest).toEqual({ one: 1, two: 1, threeOrMore: 1 });
    expect(s.byRole.map((r) => [r.key, r.count])).toEqual([
      ["direct_assignee", 3],
      ["team_member", 1],
      ["requester", 1],
      ["", 1],
    ]);
  });
});

describe("suggestionSummary", () => {
  it("counts each suggestion once; accepting wins over an earlier decline", () => {
    const a = req(5, { suggestions: { made: ["f1", "f2", "f3"], accepted: ["f1"], declined: ["f1", "f2"] } });
    const b = req(4, { suggestions: { made: [], accepted: ["f9"], declined: [] } });
    expect(suggestionSummary([a, b, req(3)])).toEqual({
      requests: 3,
      withSuggestions: 2,
      made: 4,
      accepted: 2,
      declined: 1,
      notReviewed: 1,
    });
  });
});

describe("closingSummary", () => {
  it("splits closed from open, and flags answered requests left open", () => {
    const resolved = req(20, { close: { at: 0, outcome: "resolved", secondsOpen: 4 * DAY } });
    const resolvedFast = req(19, { close: { at: 0, outcome: "resolved", secondsOpen: 2 * DAY } });
    const cancelled = req(18, { close: { at: 0, outcome: "cancelled", secondsOpen: DAY } });
    const staleAnswered = req(15);
    staleAnswered.answers = [answer(staleAnswered, 100)];
    const freshAnswered = req(3);
    freshAnswered.answers = [answer(freshAnswered, 100)];
    const s = closingSummary([resolved, resolvedFast, cancelled, staleAnswered, freshAnswered, req(1)], NOW);
    expect(s.counts).toEqual({ resolved: 2, cancelled: 1, openAnswered: 2, openUnanswered: 1 });
    expect(s.medianToResolve).toBe(3 * DAY);
    expect(s.staleAnswered).toBe(1);
  });
});

describe("formatDuration", () => {
  it("picks a unit a person would use", () => {
    expect(formatDuration(8)).toBe("8 s");
    expect(formatDuration(2549)).toBe("42 min");
    expect(formatDuration(5400)).toBe("1.5 h");
    expect(formatDuration(23 * 3600)).toBe("23 h");
    expect(formatDuration(4.2 * DAY)).toBe("4.2 days");
    expect(formatDuration(12.4 * DAY)).toBe("12 days");
  });
});
