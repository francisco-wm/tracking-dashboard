import { describe, expect, it } from "vitest";

import { dayIndex, derivePeriod, filterParams, parseFilters, share, trackedSince } from "./filters";

describe("parseFilters", () => {
  it("defaults to 90 days with everyone counted", () => {
    expect(parseFilters({})).toEqual({ days: 90, excludeInternal: false });
  });

  it("accepts the offered ranges only", () => {
    expect(parseFilters({ range: "30" }).days).toBe(30);
    expect(parseFilters({ range: "180" }).days).toBe(180);
    expect(parseFilters({ range: "45" }).days).toBe(90);
    expect(parseFilters({ range: "abc" }).days).toBe(90);
    expect(parseFilters({ range: ["30", "180"] }).days).toBe(30);
  });

  it("excludes internal users only when asked", () => {
    expect(parseFilters({ internal: "exclude" }).excludeInternal).toBe(true);
    expect(parseFilters({ internal: "include" }).excludeInternal).toBe(false);
    expect(parseFilters({ internal: "1" }).excludeInternal).toBe(false);
  });
});

describe("filterParams", () => {
  it("leaves defaults out of the URL", () => {
    expect(filterParams({ days: 90, excludeInternal: false })).toEqual({ range: null, internal: null });
    expect(filterParams({ days: 30, excludeInternal: true })).toEqual({ range: "30", internal: "exclude" });
  });

  it("round-trips through parseFilters", () => {
    const filters = { days: 180, excludeInternal: true } as const;
    const params = Object.fromEntries(
      Object.entries(filterParams(filters)).filter((e): e is [string, string] => e[1] !== null),
    );
    expect(parseFilters(params)).toEqual(filters);
  });
});

describe("derivePeriod", () => {
  it("counts today and the days before it", () => {
    const p = derivePeriod("2026-10-02", 30);
    expect(p.start).toBe("2026-09-03");
    expect(p.end).toBe("2026-10-02");
    expect(p.dates).toHaveLength(30);
    expect(p.dates[0]).toBe("2026-09-03");
    expect(p.dates.at(-1)).toBe("2026-10-02");
  });

  it("crosses a year boundary", () => {
    const p = derivePeriod("2027-01-10", 30);
    expect(p.start).toBe("2026-12-12");
    expect(p.dates).toContain("2026-12-31");
    expect(p.dates).toContain("2027-01-01");
  });

  it("counts from the tracking start when the range reaches back before it", () => {
    const p = derivePeriod("2026-10-02", 90);
    expect(p.start).toBe("2026-07-05");
    expect(p.dates).toHaveLength(90);
    expect(p.from).toBe("2026-09-23");
    expect(trackedSince(p)).toBe("2026-09-23");
  });

  it("counts the whole range once tracking is older than it", () => {
    const p = derivePeriod("2026-10-22", 30);
    expect(p.start).toBe("2026-09-23");
    expect(p.from).toBe("2026-09-23");
    expect(trackedSince(p)).toBeNull();
    expect(trackedSince(derivePeriod("2027-01-10", 30))).toBeNull();
    expect(derivePeriod("2026-10-21", 30).from).toBe("2026-09-23");
    expect(trackedSince(derivePeriod("2026-10-21", 30))).toBe("2026-09-23");
  });
});

describe("dayIndex", () => {
  const p = derivePeriod("2026-10-02", 30);

  it("places the tracking marker", () => {
    expect(dayIndex(p, "2026-09-23")).toBe(20);
  });

  it("is -1 outside the period", () => {
    expect(dayIndex(p, "2026-09-02")).toBe(-1);
    expect(dayIndex(p, "2026-10-03")).toBe(-1);
  });
});

describe("share", () => {
  it("is null with nothing to divide by", () => {
    expect(share(0, 0)).toBeNull();
    expect(share(3, 0)).toBeNull();
    expect(share(13, 52)).toBe(0.25);
  });
});
