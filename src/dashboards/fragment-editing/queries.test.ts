import { describe, expect, it } from "vitest";

import { INTERNAL_PEOPLE } from "./config";
import { completionDaily, completionTotals, listingsDaily, listingTotals, peopleFilter } from "./queries";

const QUERIES = { listingTotals, listingsDaily, completionTotals, completionDaily };

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
});
