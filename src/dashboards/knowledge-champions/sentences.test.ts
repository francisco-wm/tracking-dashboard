import { describe, expect, it } from "vitest";

import {
  afterPeriod,
  clickersSentence,
  comingBackSentence,
  contributingSentence,
  questionsSentence,
  reachSentence,
  versusBefore,
} from "./sentences";

describe("afterPeriod", () => {
  it("names send day, partial and complete windows", () => {
    expect(afterPeriod(1)).toBe("On send day");
    expect(afterPeriod(5)).toBe("In the first 5 days after the send");
    expect(afterPeriod(14)).toBe("In the 14 days after the send");
  });
});

describe("versusBefore", () => {
  it("says up, down or the same", () => {
    expect(versusBefore(72, 16, 1)).toBe("up from 16 on the matching day before");
    expect(versusBefore(3, 9, 4)).toBe("down from 9 in the same days before");
    expect(versusBefore(5, 5, 4)).toBe("the same as in the same days before");
  });
});

describe("section sentences", () => {
  it("reach", () => {
    expect(reachSentence({ send: "2026-10-01", clickers: 4, activeSinceSend: 30 })).toBe(
      "4 people have clicked “Share your knowledge” since the 1 Oct send: 13.3% of the 30 people active since then.",
    );
    expect(reachSentence({ send: "2026-10-01", clickers: 1, activeSinceSend: 9 })).toMatch(
      /^1 person has clicked/,
    );
    expect(reachSentence({ send: "2026-10-01", clickers: 0, activeSinceSend: 9 })).toBe(
      "Nobody has clicked “Share your knowledge” since the 1 Oct send yet.",
    );
  });

  it("questions", () => {
    expect(questionsSentence({ daysElapsed: 1, after: 72, before: 16 })).toBe(
      "On send day, people asked 72 questions, up from 16 on the matching day before.",
    );
    expect(questionsSentence({ daysElapsed: 3, after: 1, before: 0 })).toBe(
      "In the first 3 days after the send, people asked 1 question, up from 0 in the same days before.",
    );
  });

  it("contributing", () => {
    expect(contributingSentence({ daysElapsed: 1, after: 4, before: 0, firstTimeCreators: 1 })).toBe(
      "On send day, 4 pieces of knowledge were newly listed, up from 0 on the matching day before; 1 person listed for the first time.",
    );
    expect(contributingSentence({ daysElapsed: 14, after: 1, before: 1, firstTimeCreators: 0 })).toBe(
      "In the 14 days after the send, 1 piece of knowledge was newly listed, the same as in the same days before.",
    );
  });

  it("coming back", () => {
    expect(comingBackSentence({ cameBack: 9, typical: 9.5, sendWeekInProgress: true })).toBe(
      "So far in the send week, 9 people came back after a break, against 9.5 in a typical week before it.",
    );
    expect(comingBackSentence({ cameBack: 1, typical: null, sendWeekInProgress: false })).toBe(
      "In the send week, 1 person came back after a break.",
    );
  });

  it("clickers", () => {
    expect(clickersSentence({ clickers: 4, actedWithin24h: 1, contributedWithin7d: 1 })).toBe(
      "Of 4 clickers, 1 asked or contributed within 24 hours and 1 contributed within 7 days.",
    );
    expect(clickersSentence({ clickers: 0, actedWithin24h: 0, contributedWithin7d: 0 })).toBe(
      "Nobody has clicked yet, so there is no one to follow.",
    );
  });
});
