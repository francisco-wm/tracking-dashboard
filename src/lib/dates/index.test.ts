import { describe, expect, it } from "vitest";

import { addDays, diffDays, formatDayRange, isISODate, mondayOf, todayUTC } from ".";

describe("dates", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-01", -14)).toBe("2026-09-17");
  });

  it("counts whole days", () => {
    expect(diffDays("2026-09-17", "2026-10-01")).toBe(14);
    expect(diffDays("2026-10-01", "2026-09-17")).toBe(-14);
  });

  it("finds the Monday of a week", () => {
    expect(mondayOf("2026-10-01")).toBe("2026-09-28"); // Thursday
    expect(mondayOf("2026-09-28")).toBe("2026-09-28"); // Monday
    expect(mondayOf("2026-10-04")).toBe("2026-09-28"); // Sunday
  });

  it("uses the UTC calendar day for today", () => {
    expect(todayUTC(new Date("2026-10-01T23:30:00-02:00"))).toBe("2026-10-02");
  });

  it("validates ISO dates", () => {
    expect(isISODate("2026-10-01")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("1 Oct")).toBe(false);
  });

  it("formats ranges", () => {
    expect(formatDayRange("2026-09-17", "2026-09-30")).toBe("17–30 Sep");
    expect(formatDayRange("2026-09-28", "2026-10-04")).toBe("28 Sep – 4 Oct");
  });
});
