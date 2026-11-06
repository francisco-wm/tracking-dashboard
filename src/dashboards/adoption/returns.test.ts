import { describe, expect, it } from "vitest";

import { returnRate, returnWindowClosed, summariseReturns, type StartWeek } from "./returns";

describe("returnWindowClosed", () => {
  // Week of Mon 21 Sep: its last starter's day 1 is Sun 27 Sep, so day 28 is Sat 24 Oct.
  it("closes the day after the week's last starter has had day 28", () => {
    expect(returnWindowClosed("2026-09-21", "2026-10-24")).toBe(false);
    expect(returnWindowClosed("2026-09-21", "2026-10-25")).toBe(true);
  });

  it("keeps recent weeks open", () => {
    expect(returnWindowClosed("2026-09-28", "2026-10-30")).toBe(false);
    expect(returnWindowClosed("2026-10-26", "2026-10-30")).toBe(false);
  });
});

describe("returnRate", () => {
  it("is the share that came back once the window has closed", () => {
    expect(returnRate({ week: "2026-09-14", newPeople: 8, returned: 2 }, "2026-10-30")).toBe(0.25);
  });

  it("has no value while open, or when nobody started", () => {
    expect(returnRate({ week: "2026-10-05", newPeople: 6, returned: 1 }, "2026-10-30")).toBeNull();
    expect(returnRate({ week: "2026-09-14", newPeople: 0, returned: 0 }, "2026-10-30")).toBeNull();
  });
});

describe("summariseReturns", () => {
  const weeks: StartWeek[] = [
    { week: "2026-09-07", newPeople: 6, returned: 1 },
    { week: "2026-09-14", newPeople: 0, returned: 0 },
    { week: "2026-09-21", newPeople: 4, returned: 2 },
    { week: "2026-09-28", newPeople: 11, returned: 6 },
    { week: "2026-10-26", newPeople: 3, returned: 0 },
  ];

  it("counts only weeks whose window has closed, and keeps the rest apart", () => {
    expect(summariseReturns(weeks, "2026-10-30")).toEqual({
      started: 24,
      counted: 10,
      returned: 3,
      stillOpen: 14,
      countedUntil: "2026-09-27",
    });
  });

  it("has nothing counted before any window closes", () => {
    expect(summariseReturns(weeks.slice(3), "2026-10-30")).toEqual({
      started: 14,
      counted: 0,
      returned: 0,
      stillOpen: 14,
      countedUntil: null,
    });
  });
});
