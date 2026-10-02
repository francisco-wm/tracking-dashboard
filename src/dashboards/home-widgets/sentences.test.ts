import { describe, expect, it } from "vitest";

import { followThroughSentence, interactionsSentence, listedOf, reliabilitySentence } from "./sentences";

const DRAFTS = "Recent fragment drafts";
const REQUESTS = "Assigned knowledge requests";

describe("interactionsSentence", () => {
  it("puts clickers next to home-page visitors and names the busiest widget", () => {
    expect(
      interactionsSentence({
        days: 30,
        homePeople: 71,
        clickers: 13,
        clicks: 47,
        widgets: [
          { label: REQUESTS, clicks: 14 },
          { label: DRAFTS, clicks: 23 },
          { label: "Recent private files", clicks: 10 },
        ],
      }),
    ).toBe(
      "In the last 30 days, 13 of the 71 people who opened the home page clicked a widget item, 47 clicks in all, most in Recent fragment drafts.",
    );
  });

  it("says “all in” for a single widget and nothing for a tie", () => {
    expect(
      interactionsSentence({
        days: 90,
        homePeople: 10,
        clickers: 2,
        clicks: 1,
        widgets: [{ label: DRAFTS, clicks: 1 }],
      }),
    ).toBe(
      "In the last 90 days, 2 of the 10 people who opened the home page clicked a widget item, 1 click in all, all in Recent fragment drafts.",
    );
    expect(
      interactionsSentence({
        days: 30,
        homePeople: 5,
        clickers: 5,
        clicks: 8,
        widgets: [
          { label: DRAFTS, clicks: 4 },
          { label: REQUESTS, clicks: 4 },
        ],
      }),
    ).toBe(
      "In the last 30 days, all 5 people who opened the home page clicked a widget item, 8 clicks in all.",
    );
  });

  it("copes with odd visitor counts", () => {
    const widgets = [{ label: DRAFTS, clicks: 3 }];
    expect(interactionsSentence({ days: 30, homePeople: 1, clickers: 1, clicks: 3, widgets })).toMatch(
      /, the one person who opened the home page clicked/,
    );
    // A click without a recorded home-page view: don't claim "3 of the 2".
    expect(interactionsSentence({ days: 30, homePeople: 2, clickers: 3, clicks: 3, widgets })).toMatch(
      /, 3 people clicked a widget item/,
    );
  });

  it("opens with the tracking start when the range reaches back before it", () => {
    expect(
      interactionsSentence({
        days: 90,
        since: "2026-09-23",
        homePeople: 71,
        clickers: 13,
        clicks: 47,
        widgets: [{ label: DRAFTS, clicks: 23 }],
      }),
    ).toBe(
      "Since widget tracking started on 23 Sep, 13 of the 71 people who opened the home page clicked a widget item, 47 clicks in all, all in Recent fragment drafts.",
    );
    expect(
      reliabilitySentence({
        days: 90,
        since: "2026-09-23",
        failures: 0,
        people: 0,
        retries: 0,
        retriesWorked: 0,
      }),
    ).toBe("Since widget tracking started on 23 Sep, no widget failed to load.");
    expect(
      followThroughSentence({
        days: 180,
        since: "2026-09-23",
        opened: { drafts: 0, listed: 0 },
        started: { drafts: 0, listed: 0 },
      }),
    ).toBe(
      "Since widget tracking started on 23 Sep, no drafts were opened or started from the drafts widget.",
    );
  });

  it("handles no clicks", () => {
    expect(interactionsSentence({ days: 30, homePeople: 71, clickers: 0, clicks: 0, widgets: [] })).toBe(
      "In the last 30 days, 71 people opened the home page and nobody clicked anything in its widgets.",
    );
    expect(interactionsSentence({ days: 30, homePeople: 0, clickers: 0, clicks: 0, widgets: [] })).toBe(
      "In the last 30 days, nobody opened the home page.",
    );
  });
});

describe("listedOf", () => {
  it("agrees with the count", () => {
    expect(listedOf(1, 14, "draft", "drafts")).toBe("1 of the 14 drafts was listed");
    expect(listedOf(3, 14, "draft", "drafts")).toBe("3 of the 14 drafts were listed");
    expect(listedOf(0, 2, "draft", "drafts")).toBe("none of the 2 drafts were listed");
    expect(listedOf(2, 2, "draft", "drafts")).toBe("all 2 drafts were listed");
    expect(listedOf(1, 1, "draft", "drafts")).toBe("the one draft was listed");
    expect(listedOf(0, 1, "draft", "drafts")).toBe("the one draft wasn’t listed");
  });
});

describe("followThroughSentence", () => {
  it("covers opened and new drafts", () => {
    expect(
      followThroughSentence({
        days: 30,
        opened: { drafts: 14, listed: 1 },
        started: { drafts: 2, listed: 0 },
      }),
    ).toBe(
      "In the last 30 days, 1 of the 14 drafts opened from the drafts widget was listed within 7 days; none of the 2 new drafts started there were listed.",
    );
  });

  it("handles either side being empty", () => {
    expect(
      followThroughSentence({
        days: 30,
        opened: { drafts: 0, listed: 0 },
        started: { drafts: 1, listed: 1 },
      }),
    ).toBe(
      "In the last 30 days, no drafts were opened from the drafts widget; the one new draft started there was listed.",
    );
    expect(
      followThroughSentence({
        days: 90,
        opened: { drafts: 24, listed: 5 },
        started: { drafts: 0, listed: 0 },
      }),
    ).toBe(
      "In the last 90 days, 5 of the 24 drafts opened from the drafts widget were listed within 7 days; no new drafts were started there.",
    );
    expect(
      followThroughSentence({
        days: 30,
        opened: { drafts: 0, listed: 0 },
        started: { drafts: 0, listed: 0 },
      }),
    ).toBe("In the last 30 days, no drafts were opened or started from the drafts widget.");
  });
});

describe("reliabilitySentence", () => {
  it("says when nothing failed", () => {
    expect(reliabilitySentence({ days: 30, failures: 0, people: 0, retries: 0, retriesWorked: 0 })).toBe(
      "In the last 30 days, no widget failed to load.",
    );
    expect(reliabilitySentence({ days: 30, failures: 0, people: 0, retries: 1, retriesWorked: 1 })).toBe(
      "In the last 30 days, no failed loads were recorded, but a retry was.",
    );
  });

  it("gives failures, people and retries", () => {
    expect(reliabilitySentence({ days: 30, failures: 5, people: 3, retries: 5, retriesWorked: 4 })).toBe(
      "In the last 30 days, widgets failed to load 5 times for 3 people; 4 of 5 retries worked.",
    );
    expect(reliabilitySentence({ days: 90, failures: 1, people: 1, retries: 0, retriesWorked: 0 })).toBe(
      "In the last 90 days, a widget failed to load once for 1 person; nobody retried.",
    );
    expect(reliabilitySentence({ days: 30, failures: 2, people: 1, retries: 1, retriesWorked: 0 })).toBe(
      "In the last 30 days, widgets failed to load 2 times for 1 person; the one retry didn’t work.",
    );
  });
});
