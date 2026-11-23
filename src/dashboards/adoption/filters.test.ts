import { describe, expect, it } from "vitest";

import {
  derivePeriod,
  filterParams,
  parseFilters,
  perActive,
  share,
  trailingAverage,
  weekIndex,
} from "./filters";

describe("parseFilters", () => {
  it("defaults to 26 weeks with internal users left out", () => {
    expect(parseFilters({})).toEqual({ weeks: 26, excludeInternal: true });
  });

  it("accepts the offered ranges only", () => {
    expect(parseFilters({ range: "13" }).weeks).toBe(13);
    expect(parseFilters({ range: "52" }).weeks).toBe(52);
    expect(parseFilters({ range: "30" }).weeks).toBe(26);
    expect(parseFilters({ range: "abc" }).weeks).toBe(26);
    expect(parseFilters({ range: ["52", "13"] }).weeks).toBe(52);
  });

  it("includes internal users only when asked", () => {
    expect(parseFilters({ internal: "include" }).excludeInternal).toBe(false);
    expect(parseFilters({ internal: "exclude" }).excludeInternal).toBe(true);
  });
});

describe("filterParams", () => {
  it("leaves defaults out of the URL", () => {
    expect(filterParams({ weeks: 26, excludeInternal: true })).toEqual({ range: null, internal: null });
    expect(filterParams({ weeks: 52, excludeInternal: false })).toEqual({ range: "52", internal: "include" });
  });
});

describe("derivePeriod", () => {
  it("covers the last N Monday weeks, this one included", () => {
    // Friday 30 Oct 2026
    const period = derivePeriod("2026-10-30", 26);
    expect(period.mondays).toHaveLength(26);
    expect(period.start).toBe("2026-05-04");
    expect(period.mondays.at(-1)).toBe("2026-10-26");
    expect(period.thisWeek).toBe("2026-10-26");
    expect(period.lastWeek).toBe("2026-10-19");
    expect(period.end).toBe("2026-10-30");
  });

  it("treats a Monday as the first day of its week and a Sunday as the last", () => {
    expect(derivePeriod("2026-10-26", 13).thisWeek).toBe("2026-10-26");
    expect(derivePeriod("2026-10-26", 13).lastWeek).toBe("2026-10-19");
    expect(derivePeriod("2026-11-01", 13).thisWeek).toBe("2026-10-26");
    expect(derivePeriod("2026-11-01", 13).start).toBe("2026-08-03");
  });
});

describe("weekIndex", () => {
  const period = derivePeriod("2026-10-30", 13);

  it("finds the week containing a date", () => {
    expect(weekIndex(period, "2026-10-30")).toBe(12);
    expect(weekIndex(period, "2026-10-19")).toBe(11);
    expect(weekIndex(period, "2026-08-09")).toBe(0);
  });

  it("is -1 outside the period", () => {
    expect(weekIndex(period, "2026-08-02")).toBe(-1);
    expect(weekIndex(period, "2026-11-02")).toBe(-1);
  });
});

describe("trailingAverage", () => {
  it("averages the window ending at each week, leaving the week in progress out", () => {
    expect(trailingAverage([4, 8, 12, 16, 20, 99], 4)).toEqual([null, null, null, 10, 14, null]);
  });

  it("has no value before a full window exists", () => {
    expect(trailingAverage([1, 2, 3], 4)).toEqual([null, null, null]);
  });
});

describe("share and perActive", () => {
  it("have no value when nobody was active", () => {
    expect(share(3, 0)).toBeNull();
    expect(perActive(3, 0)).toBeNull();
  });

  it("divides, per 100 active people for requests", () => {
    expect(share(19, 38)).toBe(0.5);
    expect(perActive(6, 40)).toBe(15);
  });
});
