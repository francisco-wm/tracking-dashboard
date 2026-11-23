import { describe, expect, it } from "vitest";

import type { ISODate } from "@/lib/dates";

import { dayLabel } from "./chart-props";
import {
  countedFrom,
  derivePeriod,
  filterParams,
  parseFilters,
  startTime,
  trackedSince,
  type StartedAt,
} from "./filters";
import { isTracked, missing, parseTrackingStatus, startedInPeriod, type TrackingStatus } from "./tracking";

const at = (date: ISODate, hour = 0): StartedAt => ({ date, hour });

const STATUS: TrackingStatus = {
  sent: "2026-04-17",
  assignedTo: null,
  gapLink: "2026-10-26",
  opened: "2026-04-20",
  ignored: "2026-04-24",
  rejected: null,
  answered: "2026-10-26",
  closed: "2026-10-28",
  suggestions: "2025-12-17",
};

describe("filters", () => {
  it("defaults to 90 days with internal users left out, and keeps defaults out of the URL", () => {
    expect(parseFilters({})).toEqual({ days: 90, excludeInternal: true });
    expect(parseFilters({ range: "45" }).days).toBe(90);
    expect(parseFilters({ range: "30", internal: "exclude" })).toEqual({ days: 30, excludeInternal: true });
    expect(filterParams({ days: 90, excludeInternal: true })).toEqual({ range: null, internal: null });
    expect(filterParams({ days: 180, excludeInternal: false })).toEqual({
      range: "180",
      internal: "include",
    });
  });

  it("counts today and the days before it", () => {
    const p = derivePeriod("2026-10-28", 90);
    expect(p.start).toBe("2026-07-31");
    expect(p.end).toBe("2026-10-28");
    expect(p.from).toBe("2026-07-31");
    expect(p.dates).toHaveLength(90);
    expect(trackedSince(p)).toBeNull();
    expect(derivePeriod("2026-01-10", 30).start).toBe("2025-12-12");
  });

  it("starts counting at the tracking start when the range reaches back before it", () => {
    const p = derivePeriod("2026-10-30", 90, at("2026-10-28"));
    expect(p.from).toBe("2026-10-28");
    expect(p.dates).toEqual(["2026-10-28", "2026-10-29", "2026-10-30"]);
    expect(trackedSince(p)).toBe("2026-10-28");
    expect(countedFrom(p)).toBe("2026-10-28 00:00:00");
    // A start at midnight on the range's first day, or before it, changes nothing.
    expect(derivePeriod("2026-10-30", 30, at("2026-01-01")).from).toBe("2026-10-01");
    expect(trackedSince(derivePeriod("2026-10-30", 30, at("2026-10-01")))).toBeNull();
    // Tracking that starts today counts today only; one that hasn't started counts nothing.
    expect(derivePeriod("2026-10-28", 30, at("2026-10-28")).dates).toEqual(["2026-10-28"]);
    expect(derivePeriod("2026-10-27", 30, at("2026-10-28")).dates).toEqual([]);
  });

  it("starts counting at the tracking start's hour on its day", () => {
    const p = derivePeriod("2026-10-30", 90, at("2026-10-28", 18));
    expect(p.dates).toEqual(["2026-10-28", "2026-10-29", "2026-10-30"]);
    expect(startTime(p)).toBe("18:00");
    expect(countedFrom(p)).toBe("2026-10-28 18:00:00");
    expect(dayLabel(p, "2026-10-28")).toBe("28 Oct (from 18:00)");
    expect(dayLabel(p, "2026-10-29")).toBe("29 Oct");
    expect(dayLabel(p, "2026-10-30")).toBe("30 Oct (so far)");
    expect(dayLabel(derivePeriod("2026-10-28", 90, at("2026-10-28", 18)), "2026-10-28")).toBe(
      "28 Oct (from 18:00, so far)",
    );
    // On the range's first day, the hour still counts, so the sentences name the start.
    const first = derivePeriod("2026-11-26", 30, at("2026-10-28", 18));
    expect(first.start).toBe("2026-10-28");
    expect(countedFrom(first)).toBe("2026-10-28 18:00:00");
    expect(trackedSince(first)).toBe("2026-10-28");
    // Once that day is out of the range, the hour is too.
    const later = derivePeriod("2026-11-27", 30, at("2026-10-28", 18));
    expect(countedFrom(later)).toBe("2026-10-29 00:00:00");
    expect(startTime(later)).toBeNull();
    expect(trackedSince(later)).toBeNull();
  });
});

describe("parseTrackingStatus", () => {
  it("reads first days and treats a zero count as not tracked", () => {
    const status = parseTrackingStatus({
      sent_since: "2026-04-17",
      sent_events: 118,
      answered_since: "1970-01-01",
      answered_events: 0,
      opened_since: "2026-04-20T00:00:00Z",
      opened_events: "99",
    });
    expect(status.sent).toBe("2026-04-17");
    expect(status.answered).toBeNull();
    expect(status.opened).toBe("2026-04-20");
    expect(status.closed).toBeNull();
  });
});

describe("tracking", () => {
  const period = derivePeriod("2026-10-28", 30);

  it("shows a card once everything it needs has appeared, and names what's missing", () => {
    expect(isTracked(STATUS, ["sent", "opened", "answered"])).toBe(true);
    expect(isTracked(STATUS, ["sent", "assignedTo"])).toBe(false);
    expect(missing(STATUS, ["sent", "assignedTo", "answered", "rejected"])).toEqual([
      "assignedTo",
      "rejected",
    ]);
  });

  it("compares first days with the tracking start, not the range", () => {
    const capped = derivePeriod("2026-10-28", 30, at("2026-10-26"));
    expect(startedInPeriod(STATUS, capped, ["answered", "closed", "gapLink"])).toEqual([
      { key: "closed", date: "2026-10-28" },
    ]);
  });

  it("lists what first appeared inside the range, oldest first", () => {
    expect(startedInPeriod(STATUS, period, ["closed", "sent", "answered", "opened", "rejected"])).toEqual([
      { key: "answered", date: "2026-10-26" },
      { key: "closed", date: "2026-10-28" },
    ]);
  });

  it("treats data that appeared on the range's first day as tracked all along", () => {
    expect(startedInPeriod({ ...STATUS, answered: period.start }, period, ["answered"])).toEqual([]);
  });
});
