import { describe, expect, it } from "vitest";

import { funnel } from "./logic";
import {
  accountsSentence,
  activationSentence,
  averageCaption,
  headlineSentence,
  loopSentence,
  retentionSentence,
} from "./sentences";

describe("averageCaption", () => {
  it("gives the average and its change", () => {
    expect(averageCaption({ last: 16, average: 15.5, change: 0.12 })).toBe(
      "4-week average 15.5, up 12% on the 4 weeks before",
    );
    expect(averageCaption({ last: 1, average: 0.4, change: -0.5 }, "percent")).toBe(
      "4-week average 40%, down 50% on the 4 weeks before",
    );
    expect(averageCaption({ last: 3, average: 3, change: null })).toBe("4-week average 3.0");
    expect(averageCaption({ last: 3, average: null, change: null })).toBe(
      "Not enough weeks yet for a 4-week average",
    );
  });
});

describe("sentences", () => {
  it("opens the headline", () => {
    expect(headlineSentence({ week: "2026-11-09", active: 16, questions: 46, sourced: 21 })).toBe(
      "In the week of 9 Nov, 16 people took a core action, and 21 of 46 chat messages got a sourced answer.",
    );
    expect(headlineSentence({ week: "2026-11-09", active: 1, questions: null, sourced: null })).toBe(
      "In the week of 9 Nov, 1 person took a core action.",
    );
    expect(headlineSentence({ week: "2026-11-09", active: 0, questions: 0, sourced: 0 })).toBe(
      "Nobody took a core action in the week of 9 Nov.",
    );
  });

  it("counts organisations by health", () => {
    expect(accountsSentence({ total: 107, active: 6, red: 100, amber: 4, green: 3 })).toBe(
      "6 of 107 organisations had an active person last week: 3 green, 4 amber and 100 red.",
    );
  });

  it("says when the funnel starts", () => {
    expect(
      activationSentence({ ready: false, firstReady: "2026-11-25", citationsDay: "2026-10-28", stages: [] }),
    ).toBe(
      "The funnel starts on 25 Nov, when the first people who registered after citation tracking began (28 Oct) have had their 28 days.",
    );
    const stages = funnel([
      {
        registered: "2026-11-02 10:00:00",
        invited: false,
        core: ["2026-11-02 11:00:00"],
        cited: ["2026-11-02 11:00:00"],
      },
      { registered: "2026-11-02 10:00:00", invited: true, core: [], cited: [] },
    ]);
    expect(
      activationSentence({ ready: true, firstReady: "2026-11-25", citationsDay: "2026-10-28", stages }),
    ).toBe("1 of the 2 people who registered got a sourced answer within their first 14 days.");
  });

  it("reports week-1 and week-4 retention", () => {
    expect(retentionSentence({ week1: { active: 3, size: 10 }, week4: { active: 1, size: 8 } })).toBe(
      "30% of people were active again in the week after they registered, and 12.5% in their fourth week.",
    );
    expect(retentionSentence({ week1: { active: 0, size: 0 }, week4: { active: 0, size: 0 } })).toBe(
      "Nobody who registered in the last 16 weeks has had a full week since.",
    );
  });

  it("sums up the knowledge loop", () => {
    expect(loopSentence({ week: "2026-11-09", listed: 13, uploads: 92, questions: 46, sourced: 21 })).toBe(
      "In the week of 9 Nov, 13 fragments were listed and 92 files uploaded; 21 of 46 chat messages got a sourced answer.",
    );
    expect(loopSentence({ week: "2026-10-19", listed: 1, uploads: 1, questions: 5, sourced: null })).toBe(
      "In the week of 19 Oct, 1 fragment was listed and 1 file uploaded, and 5 chat messages were sent.",
    );
  });
});
