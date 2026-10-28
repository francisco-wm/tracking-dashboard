import { describe, expect, it } from "vitest";

import {
  answersSentence,
  closingSentence,
  gapsSentence,
  listJoin,
  notTrackedYet,
  overviewSentence,
  periodPhrase,
  routingSentence,
  trackingNote,
  waitingSentence,
} from "./sentences";

describe("shared phrases", () => {
  it("opens with the range, or the tracking start when the range reaches back before it", () => {
    expect(periodPhrase({ days: 90 })).toBe("In the last 90 days");
    expect(periodPhrase({ days: 90, since: "2026-10-28" })).toBe(
      "Since the new request tracking started on 28 Oct",
    );
  });

  it("names what isn't tracked yet", () => {
    expect(listJoin(["a", "b", "c"])).toBe("a, b and c");
    expect(notTrackedYet(["answered", "closed"])).toBe(
      "answers and closings aren’t tracked in this project yet",
    );
    expect(waitingSentence(["closed"])).toBe(
      "Closings aren’t tracked in this project yet, so this section has nothing to show yet.",
    );
  });
});

describe("trackingNote", () => {
  it("says nothing when everything was tracked before the range", () => {
    expect(trackingNote([])).toBeNull();
  });

  it("explains events that started inside the range", () => {
    expect(
      trackingNote([
        { key: "answered", date: "2026-10-26" },
        { key: "closed", date: "2026-10-28" },
      ]),
    ).toBe(
      "Answers were first tracked on 26 Oct and closing was first tracked on 28 Oct. Anything that happened before then wasn’t recorded, so these numbers can read low until those days are out of the range.",
    );
    expect(trackingNote([{ key: "closed", date: "2026-10-28" }])).toMatch(
      /until that day is out of the range\.$/,
    );
  });

  it("explains properties and gap ids in their own words", () => {
    expect(trackingNote([{ key: "assignedTo", date: "2026-10-26" }])).toBe(
      "People-or-teams routing was first tracked on 26 Oct, so requests sent before then aren’t in that comparison.",
    );
    expect(trackingNote([{ key: "gapLink", date: "2026-10-26" }])).toBe(
      "Gaps were first linked to requests on 26 Oct, so only gaps detected since then can be matched to a request.",
    );
  });
});

describe("overviewSentence", () => {
  const funnel = {
    sent: 41,
    opened: 31,
    answered: 12,
    resolved: 7,
    answeredUnopened: 0,
    resolvedUnanswered: 0,
  };

  it("walks the funnel when every step is tracked", () => {
    expect(
      overviewSentence({
        days: 90,
        funnel,
        steps: { answered: true, resolved: true },
        waiting: [],
      }),
    ).toBe(
      "In the last 90 days, 41 requests were sent: assignees opened 31, 12 were answered and 7 resolved.",
    );
  });

  it("stops at the last tracked step and says what is missing", () => {
    expect(
      overviewSentence({
        days: 90,
        funnel,
        steps: { answered: false, resolved: false },
        waiting: ["answered", "closed"],
      }),
    ).toBe(
      "In the last 90 days, 41 requests were sent: assignees opened 31; answers and closings aren’t tracked in this project yet.",
    );
  });

  it("says when nothing was sent", () => {
    expect(
      overviewSentence({
        days: 30,
        funnel: { ...funnel, sent: 0, opened: 0 },
        steps: { answered: true, resolved: true },
        waiting: [],
      }),
    ).toBe("In the last 30 days, no requests were sent.");
  });
});

describe("gapsSentence", () => {
  it("compares sent gaps with all linked gaps", () => {
    expect(gapsSentence({ days: 90, detected: 9, linked: 9, sent: 5, tracked: true })).toBe(
      "In the last 90 days, 5 of the 9 gaps the AI detected were sent as a request.",
    );
    expect(gapsSentence({ days: 90, detected: 3, linked: 3, sent: 3, tracked: true })).toBe(
      "In the last 90 days, all 3 gaps the AI detected were sent as a request.",
    );
    expect(gapsSentence({ days: 90, detected: 1, linked: 1, sent: 0, tracked: true })).toBe(
      "In the last 90 days, the one gap the AI detected wasn’t sent as a request.",
    );
  });

  it("counts every gap in the range, and says how many can't be matched", () => {
    expect(
      gapsSentence({ days: 30, detected: 30, linked: 10, sent: 6, tracked: true, linkedSince: "2026-10-26" }),
    ).toBe(
      "In the last 30 days, the AI detected 30 gaps: 6 were sent as a request, 4 weren’t and 20 can’t be matched to a request (detected before 26 Oct).",
    );
    expect(gapsSentence({ days: 30, detected: 3, linked: 1, sent: 1, tracked: true })).toBe(
      "In the last 30 days, the AI detected 3 gaps: 1 was sent as a request and 2 can’t be matched to a request.",
    );
  });

  it("still counts gaps while they can't be linked to requests", () => {
    expect(gapsSentence({ days: 90, detected: 194, linked: 0, sent: 0, tracked: false })).toBe(
      "In the last 90 days, the AI detected 194 gaps; links from gaps to requests aren’t tracked in this project yet, so it can’t tell which became requests.",
    );
  });
});

describe("routingSentence", () => {
  it("gives opens, the median wait and the unopened", () => {
    expect(
      routingSentence({
        days: 90,
        requests: 41,
        opened: 31,
        medianToOpen: 2549,
        ignored: 6,
      }),
    ).toBe(
      "In the last 90 days, assignees opened 31 of the 41 requests sent, half of them within 42 min; 6 went unopened for 7 days.",
    );
    expect(
      routingSentence({
        days: 30,
        requests: 4,
        opened: 4,
        medianToOpen: 60,
        ignored: 0,
      }),
    ).toBe(
      "In the last 30 days, assignees opened all 4 requests sent, half of them within 1 min; none went unopened for 7 days.",
    );
  });

  it("handles a single request", () => {
    expect(
      routingSentence({
        days: 30,
        requests: 1,
        opened: 0,
        medianToOpen: null,
        ignored: 1,
      }),
    ).toBe("In the last 30 days, the one request sent went unopened for 7 days.");
  });
});

describe("answersSentence", () => {
  it("reports answers when they are tracked", () => {
    expect(
      answersSentence({
        days: 30,
        answers: { requests: 8, answered: 3, medianToFirst: 2.5 * 86_400 },
        suggestions: null,
      }),
    ).toBe(
      "In the last 30 days, 3 of the 8 requests sent got an answer, the first after a median of 2.5 days.",
    );
    expect(
      answersSentence({
        days: 90,
        answers: { requests: 1, answered: 1, medianToFirst: 99 },
        suggestions: null,
      }),
    ).toBe("In the last 90 days, the one request sent got an answer, the first after 2 min.");
  });

  it("falls back to AI suggestions while answers aren't tracked", () => {
    expect(
      answersSentence({
        days: 90,
        answers: null,
        suggestions: { made: 75, withSuggestions: 22, accepted: 2, declined: 4 },
      }),
    ).toBe(
      "In the last 90 days, the AI suggested 75 answers for 22 requests; requesters accepted 2 of the 6 they reviewed. Human answers aren’t tracked in this project yet.",
    );
  });
});

describe("closingSentence", () => {
  it("splits closed and open requests", () => {
    expect(
      closingSentence({
        days: 90,
        requests: 38,
        resolved: 17,
        cancelled: 4,
        openAnswered: 7,
      }),
    ).toBe(
      "In the last 90 days, 17 of the 38 requests sent were resolved and 4 cancelled; 7 have answers but are still open.",
    );
    expect(closingSentence({ days: 30, requests: 3, resolved: 0, cancelled: 0, openAnswered: null })).toBe(
      "In the last 30 days, none of the 3 requests sent have been closed.",
    );
    expect(closingSentence({ days: 30, requests: 1, resolved: 0, cancelled: 1, openAnswered: 0 })).toBe(
      "In the last 30 days, the one request sent was cancelled.",
    );
    expect(closingSentence({ days: 90, requests: 4, resolved: 0, cancelled: 1, openAnswered: 0 })).toBe(
      "In the last 90 days, none of the 4 requests sent were resolved; 1 was cancelled.",
    );
  });
});
