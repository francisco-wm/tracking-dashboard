import { describe, expect, it } from "vitest";

import { INTERNAL_PEOPLE } from "./config";
import { gapsDaily, peopleFilter, requests, trackingStatus } from "./queries";

const FILTERED = { requests, gapsDaily };

describe("people filter", () => {
  it("counts everyone by default: no person filter at all", () => {
    for (const [name, build] of Object.entries(FILTERED)) {
      expect(build(peopleFilter(null)), name).not.toMatch(/COHORT|email|NOT \(/);
    }
    expect(trackingStatus()).not.toMatch(/COHORT|email|NOT \(/);
  });

  it("filters only who sent the request, not what happened to it", () => {
    for (const env of ["production", "staging"] as const) {
      const clause = `AND NOT (${INTERNAL_PEOPLE[env].sql})`;
      const sql = requests(peopleFilter(INTERNAL_PEOPLE[env].sql));
      expect(sql.split(clause).length - 1, env).toBe(1);
      // The one filtered scan is the knowledge_request_created one.
      const filtered = sql.slice(0, sql.indexOf(clause));
      expect(filtered.slice(filtered.lastIndexOf("FROM events"))).toContain("knowledge_request_created");
    }
  });

  it("filters the gaps, not the requests they became", () => {
    const clause = `AND NOT (${INTERNAL_PEOPLE.production.sql})`;
    expect(gapsDaily(peopleFilter(INTERNAL_PEOPLE.production.sql)).split(clause).length - 1).toBe(1);
  });
});

describe("query bounds", () => {
  it("bounds every events scan", () => {
    const check = (sql: string, lower: RegExp) => {
      const scans = sql.split("FROM events").length - 1;
      expect(sql.match(new RegExp(lower.source, "g"))?.length).toBe(scans);
    };
    check(requests(""), /timestamp >= toDateTime\(\{start\}\)/);
    check(trackingStatus(), /timestamp >= toDateTime\(\{since\}\)/);
    check(gapsDaily(""), /timestamp >= toDateTime\(\{start\}\)/);
  });

  it("joins suggestions on their own request id property", () => {
    const sql = requests("");
    expect(sql).toContain("toString(properties.knowledge_request_id) AS request");
    expect(sql.match(/toString\(properties\.knowledge_request_uuid\) AS request/g)).toHaveLength(6);
  });
});
