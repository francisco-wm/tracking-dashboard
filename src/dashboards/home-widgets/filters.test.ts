import { describe, expect, it } from "vitest";

import { dayIndex, derivePeriod, filterParams, parseFilters, share } from "./filters";

describe("parseFilters", () => {
  it("defaults to 30 days with everyone counted", () => {
    expect(parseFilters({})).toEqual({ days: 30, excludeInternal: false });
  });

  it("accepts the offered ranges only", () => {
    expect(parseFilters({ range: "90" }).days).toBe(90);
    expect(parseFilters({ range: "180" }).days).toBe(180);
    expect(parseFilters({ range: "45" }).days).toBe(30);
    expect(parseFilters({ range: "abc" }).days).toBe(30);
    expect(parseFilters({ range: ["90", "180"] }).days).toBe(90);
  });

  it("excludes internal users only when asked", () => {
    expect(parseFilters({ internal: "exclude" }).excludeInternal).toBe(true);
    expect(parseFilters({ internal: "include" }).excludeInternal).toBe(false);
    expect(parseFilters({ internal: "1" }).excludeInternal).toBe(false);
  });
});

describe("filterParams", () => {
  it("leaves defaults out of the URL", () => {
    expect(filterParams({ days: 30, excludeInternal: false })).toEqual({ range: null, internal: null });
    expect(filterParams({ days: 90, excludeInternal: true })).toEqual({ range: "90", internal: "exclude" });
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
});

describe("dayIndex", () => {
  const p = derivePeriod("2026-10-02", 30);

  it("places the launch markers", () => {
    expect(dayIndex(p, "2026-09-14")).toBe(11);
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
