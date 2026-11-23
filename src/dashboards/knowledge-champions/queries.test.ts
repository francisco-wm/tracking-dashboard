import { describe, expect, it } from "vitest";

import { INTERNAL_PEOPLE } from "./config";
import { filterParams, parseFilters } from "./filters";
import {
  CLICKERS,
  FIRST_TIME_CREATORS,
  LIFECYCLE,
  LISTINGS_DAILY,
  peopleFilter,
  WEEKLY,
  WINDOW_DAILY,
  WINDOW_UNIQUES,
} from "./queries";

const QUERIES = {
  WINDOW_DAILY,
  WINDOW_UNIQUES,
  FIRST_TIME_CREATORS,
  WEEKLY,
  LIFECYCLE,
  LISTINGS_DAILY,
  CLICKERS,
};

describe("filters", () => {
  it("leaves internal users out by default and keeps that out of the URL", () => {
    expect(parseFilters({})).toEqual({ excludeInternal: true });
    expect(parseFilters({ internal: "include" })).toEqual({ excludeInternal: false });
    expect(filterParams({ excludeInternal: true })).toEqual({ internal: null });
    expect(filterParams({ excludeInternal: false })).toEqual({ internal: "include" });
  });
});

describe("people filter", () => {
  it("adds no person filter when everyone is counted", () => {
    for (const [name, build] of Object.entries(QUERIES)) {
      expect(build(peopleFilter(null)), name).not.toMatch(/COHORT|@wingmaite|NOT \(/);
    }
  });

  it("drops internal users from every query", () => {
    for (const env of ["production", "staging"] as const) {
      const clause = peopleFilter(INTERNAL_PEOPLE[env].sql);
      for (const [name, build] of Object.entries(QUERIES)) {
        expect(build(clause), `${name} ${env}`).toContain(`AND NOT (${INTERNAL_PEOPLE[env].sql})`);
      }
    }
  });

  it("matches the other dashboards' definition of internal users", async () => {
    const fragmentEditing = await import("@/dashboards/fragment-editing/config");
    expect(INTERNAL_PEOPLE).toEqual(fragmentEditing.INTERNAL_PEOPLE);
  });
});
