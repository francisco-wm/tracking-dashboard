import { describe, expect, it } from "vitest";

import {
  alignByDayIndex,
  deriveWindows,
  latestSend,
  longestZeroRun,
  runningTotals,
  sendMarkers,
  weeklyRange,
} from "./windows";

describe("latestSend", () => {
  it("picks the latest send on or before today", () => {
    expect(latestSend(["2026-10-01", "2027-01-07"], "2027-01-20")).toBe("2027-01-07");
  });

  it("ignores sends that haven't happened yet", () => {
    expect(latestSend(["2026-10-01", "2027-01-07"], "2026-12-31")).toBe("2026-10-01");
  });

  it("counts a send happening today", () => {
    expect(latestSend(["2026-10-01"], "2026-10-01")).toBe("2026-10-01");
  });

  it("does not depend on config order", () => {
    expect(latestSend(["2027-01-07", "2026-10-01"], "2027-02-01")).toBe("2027-01-07");
  });

  it("returns null before the first send", () => {
    expect(latestSend(["2026-10-01"], "2026-09-30")).toBeNull();
  });
});

describe("deriveWindows", () => {
  const windows = deriveWindows("2026-10-01", "2026-10-01");

  it("after window is send day + 13 days", () => {
    expect(windows.after.start).toBe("2026-10-01");
    expect(windows.after.end).toBe("2026-10-14");
    expect(windows.after.days).toHaveLength(14);
  });

  it("before window is the 14 days immediately before the send", () => {
    expect(windows.before.start).toBe("2026-09-17");
    expect(windows.before.end).toBe("2026-09-30");
    expect(windows.before.days).toHaveLength(14);
  });

  it("send day is day 1 of the after window", () => {
    expect(windows.daysElapsed).toBe(1);
  });

  it("counts elapsed days mid-window", () => {
    expect(deriveWindows("2026-10-01", "2026-10-05").daysElapsed).toBe(5);
  });

  it("caps elapsed days once the window is over", () => {
    expect(deriveWindows("2026-10-01", "2026-12-01").daysElapsed).toBe(14);
  });

  it("crosses month and year boundaries", () => {
    const w = deriveWindows("2027-01-07", "2027-02-01");
    expect(w.before.start).toBe("2026-12-24");
    expect(w.after.end).toBe("2027-01-20");
  });
});

describe("alignByDayIndex + runningTotals", () => {
  const windows = deriveWindows("2026-10-01", "2026-10-03");
  const counts = new Map([
    ["2026-09-17", 2], // before day 1
    ["2026-09-18", 3], // before day 2
    ["2026-10-01", 5], // after day 1
    ["2026-10-03", 1], // after day 3
    ["2026-10-04", 9], // after day 4: in the future, must be ignored
  ]);
  const pairs = alignByDayIndex(windows, counts);

  it("matches days by index", () => {
    expect(pairs[0]).toMatchObject({
      day: 1,
      beforeDate: "2026-09-17",
      afterDate: "2026-10-01",
      before: 2,
      after: 5,
    });
    expect(pairs[1]).toMatchObject({ day: 2, before: 3, after: 0 });
  });

  it("leaves days that haven't happened empty", () => {
    expect(pairs[2].after).toBe(1);
    expect(pairs[3].after).toBeNull();
    expect(pairs[13].after).toBeNull();
  });

  it("running totals stop at today instead of going flat", () => {
    const totals = runningTotals(pairs);
    expect(totals.map((p) => p.after).slice(0, 4)).toEqual([5, 5, 6, null]);
    expect(totals.at(-1)!.before).toBe(5);
    expect(totals.at(-1)!.after).toBeNull();
  });
});

describe("weeklyRange", () => {
  it("returns Monday-start weeks ending with the current week", () => {
    const range = weeklyRange("2026-10-01", 26);
    expect(range.weeks).toHaveLength(26);
    expect(range.weeks.at(-1)).toBe("2026-09-28");
    expect(range.partialWeek).toBe("2026-09-28");
    expect(range.start).toBe("2026-04-06");
  });

  it("treats Sunday as the end of the week", () => {
    expect(weeklyRange("2026-10-04", 2).weeks).toEqual(["2026-09-21", "2026-09-28"]);
  });

  it("treats Monday as the start of a new week", () => {
    expect(weeklyRange("2026-10-05", 1).weeks).toEqual(["2026-10-05"]);
  });
});

describe("sendMarkers", () => {
  const range = weeklyRange("2026-10-01", 26);

  it("marks every send inside the range", () => {
    expect(sendMarkers(["2026-10-01", "2026-07-01"], range, "2026-10-01")).toEqual([
      "2026-07-01",
      "2026-10-01",
    ]);
  });

  it("drops sends before the range or in the future", () => {
    expect(sendMarkers(["2026-01-01", "2026-12-01"], range, "2026-10-01")).toEqual([]);
  });
});

describe("longestZeroRun", () => {
  const day = (n: number) => `2026-09-${String(n).padStart(2, "0")}`;

  it("finds the longest run of zero days", () => {
    const counts = [1, 0, 0, 2, 0, 0, 0, 3].map((count, i) => ({ date: day(i + 1), count }));
    expect(longestZeroRun(counts)).toEqual({ length: 3, start: day(5), end: day(7) });
  });

  it("handles a run that reaches the last day", () => {
    const counts = [1, 0, 0].map((count, i) => ({ date: day(i + 1), count }));
    expect(longestZeroRun(counts)).toEqual({ length: 2, start: day(2), end: day(3) });
  });

  it("returns null without zero days", () => {
    expect(longestZeroRun([{ date: day(1), count: 4 }])).toBeNull();
  });
});
