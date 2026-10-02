import { describe, expect, it } from "vitest";

import { byWidgetOrder, dailyByWidget } from "./series";

const DATES = ["2026-09-30", "2026-10-01", "2026-10-02"];

describe("dailyByWidget", () => {
  it("gives every known widget a zero-filled line", () => {
    expect(dailyByWidget(DATES, [])).toEqual({
      "recent-fragment-drafts": [0, 0, 0],
      "assigned-knowledge-requests": [0, 0, 0],
      "recent-private-files": [0, 0, 0],
    });
  });

  it("puts each row on its day", () => {
    const out = dailyByWidget(DATES, [
      { day: "2026-09-30", widget: "recent-fragment-drafts", value: 10 },
      { day: "2026-10-02", widget: "recent-fragment-drafts", value: 1 },
      { day: "2026-10-01", widget: "recent-private-files", value: 4 },
    ]);
    expect(out["recent-fragment-drafts"]).toEqual([10, 0, 1]);
    expect(out["recent-private-files"]).toEqual([0, 4, 0]);
    expect(out["assigned-knowledge-requests"]).toEqual([0, 0, 0]);
  });

  it("leaves days before tracking started empty and drops their rows", () => {
    const out = dailyByWidget(
      DATES,
      [
        { day: "2026-09-30", widget: "recent-fragment-drafts", value: 3 },
        { day: "2026-10-01", widget: "recent-fragment-drafts", value: 2 },
        { day: "2026-09-30", widget: "test-widget", value: 1 },
      ],
      "2026-10-01",
    );
    expect(out["recent-fragment-drafts"]).toEqual([null, 2, 0]);
    expect(out["recent-private-files"]).toEqual([null, 0, 0]);
    expect(out["test-widget"]).toBeUndefined();
  });

  it("keeps widgets it doesn't know and ignores days outside the period", () => {
    const out = dailyByWidget(DATES, [
      { day: "2026-10-01", widget: "new-widget", value: 2 },
      { day: "2026-09-29", widget: "recent-fragment-drafts", value: 5 },
    ]);
    expect(out["new-widget"]).toEqual([0, 2, 0]);
    expect(out["recent-fragment-drafts"]).toEqual([0, 0, 0]);
  });
});

describe("byWidgetOrder", () => {
  it("keeps the widget order, then unknown widgets by value", () => {
    const rows = [
      { widget: "zzz", n: 1 },
      { widget: "recent-private-files", n: 10 },
      { widget: "yyy", n: 5 },
      { widget: "recent-fragment-drafts", n: 2 },
      { widget: "recent-fragment-drafts", n: 21 },
    ];
    expect(byWidgetOrder(rows, (r) => r.n)).toEqual([
      { widget: "recent-fragment-drafts", n: 21 },
      { widget: "recent-fragment-drafts", n: 2 },
      { widget: "recent-private-files", n: 10 },
      { widget: "yyy", n: 5 },
      { widget: "zzz", n: 1 },
    ]);
  });
});
