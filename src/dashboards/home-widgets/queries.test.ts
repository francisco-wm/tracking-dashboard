import { describe, expect, it } from "vitest";

import { METRIC_SQL } from "@/lib/posthog/metrics";

import { INTERNAL_PEOPLE } from "./config";
import {
  clicksByAction,
  clicksByWidget,
  clicksDaily,
  failuresDaily,
  homeTotals,
  newDrafts,
  openedDrafts,
  peopleFilter,
  reliabilityByWidget,
  requestFollowThrough,
} from "./queries";

const QUERIES = {
  homeTotals,
  clicksByWidget,
  clicksByAction,
  clicksDaily,
  newDrafts,
  openedDrafts,
  requestFollowThrough,
  reliabilityByWidget,
  failuresDaily,
};

describe("people filter", () => {
  it("counts everyone by default: no person filter at all", () => {
    for (const [name, build] of Object.entries(QUERIES)) {
      const sql = build(peopleFilter(null));
      expect(sql, name).not.toMatch(/COHORT|email|NOT \(/);
    }
  });

  it("drops internal users only when asked", () => {
    for (const env of ["production", "staging"] as const) {
      const clause = peopleFilter(INTERNAL_PEOPLE[env].sql);
      for (const [name, build] of Object.entries(QUERIES)) {
        expect(build(clause), `${name} ${env}`).toContain(`AND NOT (${INTERNAL_PEOPLE[env].sql})`);
      }
    }
  });

  it("filters the clicks, not what follows them", () => {
    const clause = peopleFilter(INTERNAL_PEOPLE.production.sql);
    const count = (sql: string) => sql.split(`AND NOT (${INTERNAL_PEOPLE.production.sql})`).length - 1;
    expect(count(newDrafts(clause))).toBe(1);
    expect(count(requestFollowThrough(clause))).toBe(1);
    // The click subquery, and again where it narrows the page views to clickers.
    expect(count(openedDrafts(clause))).toBe(2);
  });
});

describe("request follow-through", () => {
  it("counts a published answer, or the old backend's completion", () => {
    const sql = requestFollowThrough("");
    expect(sql).toContain(METRIC_SQL.requestAnswered);
    expect(sql).toContain(METRIC_SQL.requestCompleted);
  });
});

describe("query bounds", () => {
  it("bounds every events scan by the period", () => {
    for (const [name, build] of Object.entries(QUERIES)) {
      const sql = build("");
      const scans = sql.split("FROM events").length - 1;
      const bounded = sql.split("timestamp >= toDateTime({start})").length - 1;
      expect(bounded, name).toBe(scans);
    }
  });
});
