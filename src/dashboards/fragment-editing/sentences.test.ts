import { describe, expect, it } from "vitest";

import { completionSentence, editsListedSentence } from "./sentences";

describe("editsListedSentence", () => {
  it("puts edits next to new knowledge", () => {
    expect(editsListedSentence({ days: 90, fragments: 5, newListings: 129 })).toBe(
      "In the last 90 days, edits to 5 fragments were listed, next to 129 new pieces of knowledge.",
    );
    expect(editsListedSentence({ days: 30, fragments: 1, newListings: 1 })).toBe(
      "In the last 30 days, edits to 1 fragment were listed, next to 1 new piece of knowledge.",
    );
  });

  it("handles either side being zero", () => {
    expect(editsListedSentence({ days: 90, fragments: 0, newListings: 47 })).toBe(
      "In the last 90 days, no edits were listed, next to 47 new pieces of knowledge.",
    );
    expect(editsListedSentence({ days: 30, fragments: 2, newListings: 0 })).toBe(
      "In the last 30 days, edits to 2 fragments were listed and no new knowledge was.",
    );
    expect(editsListedSentence({ days: 30, fragments: 0, newListings: 0 })).toBe(
      "In the last 30 days, nothing new or edited was listed.",
    );
  });
});

describe("completionSentence", () => {
  it("gives the rate and the counts, per edit", () => {
    expect(completionSentence({ days: 90, started: 4, listed: 2, stillInDraft: 0 })).toBe(
      "In the last 90 days, 50% of edits started were listed: 2 of 4.",
    );
  });

  it("says how many of the rest are still in draft", () => {
    expect(completionSentence({ days: 90, started: 13, listed: 7, stillInDraft: 6 })).toBe(
      "In the last 90 days, 53.8% of edits started were listed: 7 of 13; the other 6 are still in draft.",
    );
    expect(completionSentence({ days: 90, started: 3, listed: 2, stillInDraft: 1 })).toBe(
      "In the last 90 days, 66.7% of edits started were listed: 2 of 3; the other one is still in draft.",
    );
    expect(completionSentence({ days: 180, started: 10, listed: 4, stillInDraft: 1 })).toBe(
      "In the last 180 days, 40% of edits started were listed: 4 of 10; 1 of the other 6 is still in draft.",
    );
    expect(completionSentence({ days: 180, started: 10, listed: 4, stillInDraft: 3 })).toMatch(
      /; 3 of the other 6 are still in draft\.$/,
    );
  });

  it("handles no started edits", () => {
    expect(completionSentence({ days: 30, started: 0, listed: 0, stillInDraft: 0 })).toBe(
      "In the last 30 days, nobody started editing a listed fragment.",
    );
  });
});
