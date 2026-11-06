import { describe, expect, it } from "vitest";

import { activeSentence, activitySentence, changePhrase, orgsSentence, returnSentence } from "./sentences";

describe("changePhrase", () => {
  it("says more, fewer or the same", () => {
    expect(changePhrase(37, 29)).toBe("8 more than 4 weeks before");
    expect(changePhrase(29, 37)).toBe("8 fewer than 4 weeks before");
    expect(changePhrase(5, 5)).toBe("Same as 4 weeks before");
  });
});

describe("activeSentence", () => {
  it("compares last week with four weeks before", () => {
    expect(activeSentence({ week: "2026-10-19", active: 37, fourWeeksBefore: 29 })).toBe(
      "In the week of 19 Oct, 37 people used wingmaite, up from 29 four weeks before.",
    );
    expect(activeSentence({ week: "2026-10-19", active: 1, fourWeeksBefore: 4 })).toBe(
      "In the week of 19 Oct, 1 person used wingmaite, down from 4 four weeks before.",
    );
    expect(activeSentence({ week: "2026-10-19", active: 12, fourWeeksBefore: 12 })).toBe(
      "In the week of 19 Oct, 12 people used wingmaite, the same as four weeks before.",
    );
  });

  it("handles nobody being active", () => {
    expect(activeSentence({ week: "2026-10-19", active: 0, fourWeeksBefore: 3 })).toBe(
      "Nobody used wingmaite in the week of 19 Oct, down from 3 four weeks before.",
    );
    expect(activeSentence({ week: "2026-10-19", active: 0, fourWeeksBefore: 0 })).toBe(
      "Nobody used wingmaite in the week of 19 Oct, nor four weeks before.",
    );
  });
});

describe("returnSentence", () => {
  const base = { start: "2026-05-04", weeks: 26 };

  it("gives the rate over the weeks whose four weeks are up", () => {
    const summary = { started: 150, counted: 126, returned: 14, stillOpen: 24, countedUntil: "2026-09-27" };
    expect(returnSentence({ summary, ...base })).toBe(
      "11.1% of the people who started using wingmaite between 4 May and 27 Sep came back after their first two weeks: 14 of 126.",
    );
  });

  it("handles nobody new, or nobody who has had four weeks yet", () => {
    const none = { started: 0, counted: 0, returned: 0, stillOpen: 0, countedUntil: null };
    expect(returnSentence({ summary: none, ...base })).toBe(
      "Nobody started using wingmaite in the last 26 weeks.",
    );
    const open = { started: 3, counted: 0, returned: 0, stillOpen: 3, countedUntil: null };
    expect(returnSentence({ summary: open, start: "2026-10-05", weeks: 4 })).toBe(
      "3 people started using wingmaite in the last 4 weeks, but nobody has had four weeks yet to come back.",
    );
  });
});

describe("activitySentence", () => {
  it("gives the counts and the rate per 100 active people", () => {
    expect(activitySentence({ week: "2026-10-19", active: 37, created: 6, answered: 2 })).toBe(
      "In the week of 19 Oct, 37 people were active, and 6 knowledge requests were created and 2 answered: 16.2 and 5.4 per 100 active people.",
    );
    expect(activitySentence({ week: "2026-10-19", active: 20, created: 1, answered: 0 })).toBe(
      "In the week of 19 Oct, 20 people were active, and 1 knowledge request was created and 0 answered: 5.0 and 0.0 per 100 active people.",
    );
  });

  it("handles no requests and nobody active", () => {
    expect(activitySentence({ week: "2026-10-19", active: 1, created: 0, answered: 0 })).toBe(
      "In the week of 19 Oct, 1 person was active and no knowledge requests were created or answered.",
    );
    expect(activitySentence({ week: "2026-10-19", active: 0, created: 0, answered: 0 })).toBe(
      "Nobody used wingmaite in the week of 19 Oct.",
    );
  });
});

describe("orgsSentence", () => {
  it("puts last week next to the whole period", () => {
    expect(orgsSentence({ week: "2026-10-19", active: 13, total: 30, newOrgs: 9, weeks: 26 })).toBe(
      "In the week of 19 Oct, 13 organisations had at least one active person; 30 did in the last 26 weeks, 9 of them for the first time.",
    );
    expect(orgsSentence({ week: "2026-10-19", active: 1, total: 4, newOrgs: 0, weeks: 13 })).toBe(
      "In the week of 19 Oct, 1 organisation had at least one active person; 4 did in the last 13 weeks, none of them new.",
    );
  });

  it("handles quiet weeks", () => {
    expect(orgsSentence({ week: "2026-10-19", active: 0, total: 4, newOrgs: 1, weeks: 13 })).toBe(
      "No organisation had an active person in the week of 19 Oct; 4 did in the last 13 weeks, 1 of them for the first time.",
    );
    expect(orgsSentence({ week: "2026-10-19", active: 0, total: 0, newOrgs: 0, weeks: 13 })).toBe(
      "No organisation had an active person in the last 13 weeks.",
    );
  });
});
