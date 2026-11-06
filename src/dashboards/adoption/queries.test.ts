import { describe, expect, it } from "vitest";

import { INTERNAL_PEOPLE } from "./config";
import {
  lifecycle,
  newPeople,
  organisations,
  peopleFilter,
  periodTotals,
  weeklyEvents,
  weeklyPeople,
} from "./queries";

const QUERIES = { periodTotals, weeklyPeople, weeklyEvents, lifecycle, newPeople, organisations };

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

  it("matches the other dashboards' definition of internal users", async () => {
    const fragmentEditing = await import("@/dashboards/fragment-editing/config");
    expect(INTERNAL_PEOPLE).toEqual(fragmentEditing.INTERNAL_PEOPLE);
  });
});

describe("active", () => {
  it("only counts page views inside an organisation's app", () => {
    for (const [name, build] of Object.entries(QUERIES)) {
      expect(build(""), name).toMatch(/\^\/\(o\|dashboard\)\/\[\^\/\]\+/);
    }
  });
});
