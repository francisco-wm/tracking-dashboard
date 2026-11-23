import { describe, expect, it } from "vitest";

import { completionRate, dayIndex, derivePeriod, filterParams, parseFilters } from "./filters";

describe("parseFilters", () => {
  it("defaults to 90 days with internal users left out", () => {
    expect(parseFilters({})).toEqual({ days: 90, excludeInternal: true });
  });

  it("accepts the offered ranges only", () => {
    expect(parseFilters({ range: "30" }).days).toBe(30);
    expect(parseFilters({ range: "180" }).days).toBe(180);
    expect(parseFilters({ range: "45" }).days).toBe(90);
    expect(parseFilters({ range: "abc" }).days).toBe(90);
    expect(parseFilters({ range: ["180", "30"] }).days).toBe(180);
  });

  it("includes internal users only when asked", () => {
    expect(parseFilters({ internal: "include" }).excludeInternal).toBe(false);
    expect(parseFilters({ internal: "exclude" }).excludeInternal).toBe(true);
    expect(parseFilters({ internal: "1" }).excludeInternal).toBe(true);
  });
});

describe("filterParams", () => {
  it("leaves defaults out of the URL", () => {
    expect(filterParams({ days: 90, excludeInternal: true })).toEqual({ range: null, internal: null });
    expect(filterParams({ days: 30, excludeInternal: false })).toEqual({ range: "30", internal: "include" });
  });

  it("round-trips through parseFilters", () => {
    const filters = { days: 180, excludeInternal: false } as const;
    const params = Object.fromEntries(
      Object.entries(filterParams(filters)).filter((e): e is [string, string] => e[1] !== null),
    );
    expect(parseFilters(params)).toEqual(filters);
  });
});

describe("derivePeriod", () => {
  it("counts today and the days before it", () => {
    const p = derivePeriod("2026-10-02", 90);
    expect(p.start).toBe("2026-07-05");
    expect(p.end).toBe("2026-10-02");
    expect(p.dates).toHaveLength(90);
    expect(p.dates[0]).toBe("2026-07-05");
    expect(p.dates.at(-1)).toBe("2026-10-02");
  });

  it("covers each range day by day", () => {
    expect(derivePeriod("2026-10-02", 30).start).toBe("2026-09-03");
    expect(derivePeriod("2026-10-02", 180).start).toBe("2026-04-06");
    expect(derivePeriod("2026-10-02", 180).dates).toHaveLength(180);
  });

  it("crosses a year boundary", () => {
    const p = derivePeriod("2027-01-10", 30);
    expect(p.start).toBe("2026-12-12");
    expect(p.dates).toContain("2026-12-31");
    expect(p.dates).toContain("2027-01-01");
  });
});

describe("dayIndex", () => {
  const p = derivePeriod("2026-10-02", 30);

  it("finds the day on the timeline", () => {
    expect(dayIndex(p, "2026-09-03")).toBe(0);
    expect(dayIndex(p, "2026-09-23")).toBe(20);
    expect(dayIndex(p, "2026-10-02")).toBe(29);
  });

  it("is -1 outside the period", () => {
    expect(dayIndex(p, "2026-09-02")).toBe(-1);
    expect(dayIndex(p, "2026-10-03")).toBe(-1);
  });
});

describe("completionRate", () => {
  it("is null without started edits", () => {
    expect(completionRate(0, 0)).toBeNull();
    expect(completionRate(2, 4)).toBe(0.5);
  });
});
