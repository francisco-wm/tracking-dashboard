import { describe, expect, it } from "vitest";

import { formatNumber, linearScale, markerRows, niceTicks } from "./scale";

describe("niceTicks", () => {
  it("covers the data with clean steps from zero", () => {
    expect(niceTicks(0, 72)).toEqual({ min: 0, max: 80, values: [0, 20, 40, 60, 80] });
  });

  it("never produces fractional ticks for counts", () => {
    expect(niceTicks(0, 3).values).toEqual([0, 1, 2, 3]);
  });

  it("allows fractional ticks for ratios", () => {
    expect(niceTicks(0, 1.7, 4, false).values).toEqual([0, 0.5, 1, 1.5, 2]);
  });

  it("spans negative values (dropped off)", () => {
    const ticks = niceTicks(-43, 30);
    expect(ticks.min).toBeLessThanOrEqual(-43);
    expect(ticks.max).toBeGreaterThanOrEqual(30);
    expect(ticks.values).toContain(0);
  });

  it("handles all-zero data", () => {
    expect(niceTicks(0, 0)).toEqual({ min: 0, max: 1, values: [0, 1] });
  });
});

describe("linearScale", () => {
  it("maps domain to range, including inverted ranges", () => {
    const y = linearScale([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(50)).toBe(100);
  });
});

describe("formatNumber", () => {
  it("formats counts, ratios and shares", () => {
    expect(formatNumber(1284)).toBe("1,284");
    expect(formatNumber(2.345, "decimal")).toBe("2.3");
    expect(formatNumber(0.1333, "percent")).toBe("13.3%");
  });
});

describe("markerRows", () => {
  it("lifts a label that would overlap the one before it", () => {
    // 15 characters ≈ 90px wide, centred: 455–545; the next ends at 613, starting at 517
    expect(
      markerRows([
        { x: 613, label: "Requests released", end: true },
        { x: 500, label: "Champions email", end: false },
      ]),
    ).toEqual([1, 0]);
  });

  it("keeps labels apart on the usual line", () => {
    expect(
      markerRows([
        { x: 100, label: "Send", end: false },
        { x: 300, label: "Send", end: false },
      ]),
    ).toEqual([0, 0]);
  });
});
