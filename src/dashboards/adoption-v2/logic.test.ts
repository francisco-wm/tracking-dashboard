import { describe, expect, it } from "vitest";

import { INTERNAL_PEOPLE } from "../adoption/config";
import { peopleFilter } from "../adoption/queries";
import { markers } from "./chart";
import { derivePeriod, filterParams, parseFilters } from "./filters";
import {
  activationWindow,
  cohortTable,
  composition,
  fourWeekMean,
  funnel,
  headline,
  health,
  median,
  trend,
  weightedRetention,
  type Registration,
} from "./logic";
import * as queries from "./queries";

describe("filters", () => {
  it("leaves internal users out unless asked", () => {
    expect(parseFilters({})).toEqual({ weeks: 26, excludeInternal: true });
    expect(parseFilters({ internal: "include" }).excludeInternal).toBe(false);
    expect(filterParams({ weeks: 26, excludeInternal: true })).toEqual({ range: null, internal: null });
    expect(filterParams({ weeks: 13, excludeInternal: false })).toEqual({ range: "13", internal: "include" });
  });

  it("puts the internal-users clause in every query", () => {
    const clause = peopleFilter(INTERNAL_PEOPLE.production.sql);
    for (const [name, build] of Object.entries(queries)) {
      expect(build(clause), name).toContain(`AND NOT (${INTERNAL_PEOPLE.production.sql})`);
      expect(build(""), name).not.toMatch(/COHORT|email/);
    }
  });
});

describe("averages", () => {
  it("needs 4 present weeks", () => {
    expect(fourWeekMean([1, 2, 3, 4, 5], 4)).toBe(3.5);
    expect(fourWeekMean([1, 2, 3], 2)).toBeNull();
    expect(fourWeekMean([1, null, 3, 4], 3)).toBeNull();
  });

  it("compares the last 4 weeks with the 4 before", () => {
    expect(headline([1, 1, 1, 1, 2, 2, 2, 2], 7)).toEqual({ last: 2, average: 2, change: 1 });
    expect(headline([0, 0, 0, 0, 2, 2, 2, 2], 7).change).toBeNull();
    expect(headline([null, null, 3, 4], 3)).toEqual({ last: 4, average: null, change: null });
  });

  it("takes the middle value", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("activationWindow", () => {
  const started = "2026-10-28 18:00:00";

  it("waits until someone registered after citations began has had 28 days", () => {
    const w = activationWindow("2026-11-18", started);
    expect(w).toMatchObject({ to: "2026-10-22", ready: false, firstReady: "2026-11-25" });
    expect(activationWindow("2026-11-24", started).ready).toBe(false);
    expect(activationWindow("2026-11-25", started)).toMatchObject({
      from: started,
      to: "2026-10-29",
      ready: true,
    });
  });

  it("follows 12 weeks once citations are old enough", () => {
    expect(activationWindow("2027-06-01", started)).toMatchObject({
      from: "2027-02-10 00:00:00",
      to: "2027-05-05",
    });
  });
});

describe("funnel", () => {
  const reg = (core: string[], cited: string[], invited = false): Registration => ({
    registered: "2026-11-02 10:00:00.000000",
    invited,
    core,
    cited,
  });

  it("nests the steps and counts days from registering", () => {
    const stages = funnel([
      // acted, aha, back on day 9
      reg(["2026-11-02 12:00:00", "2026-11-10 10:00:00"], ["2026-11-03 10:00:00"]),
      // acted, aha, never back
      reg(["2026-11-02 11:00:00"], ["2026-11-02 11:00:00"]),
      // acted on day 15: too late, so nothing further counts
      reg(["2026-11-16 10:00:00"], ["2026-11-16 10:00:00"]),
      // back on day 9 without an aha moment: doesn't count as returned
      reg(["2026-11-02 12:00:00", "2026-11-10 10:00:00"], []),
      reg([], []),
    ]);
    expect(stages.map((s) => s.people)).toEqual([5, 3, 2, 1]);
    expect(stages.map((s) => s.ofPrevious)).toEqual([null, 3 / 5, 2 / 3, 1 / 2]);
    expect(stages[2].medianDays).toBeCloseTo((1 + 1 / 24) / 2);
    expect(stages[3].medianDays).toBe(8);
  });

  it("counts day 28 but not day 29 as coming back", () => {
    const back = (day: string) =>
      funnel([reg(["2026-11-02 12:00:00", day], ["2026-11-02 12:00:00"])])[3].people;
    expect(back("2026-11-29 23:59:00")).toBe(1);
    expect(back("2026-11-09 00:00:00")).toBe(1);
    expect(back("2026-11-08 23:59:00")).toBe(0);
  });
});

describe("cohorts", () => {
  const people = [
    { registered: "2026-11-02", weeks: ["2026-11-02", "2026-11-09"] },
    { registered: "2026-11-02", weeks: ["2026-11-02"] },
    { registered: "2026-10-26", weeks: ["2026-11-09"] },
    { registered: null, weeks: ["2026-11-09"] },
  ];

  it("leaves weeks that aren't complete empty", () => {
    const rows = cohortTable(people, "2026-11-09");
    expect(rows).toHaveLength(16);
    expect(rows[0]).toMatchObject({ week: "2026-11-09", size: 0 });
    expect(rows[1].active.slice(0, 3)).toEqual([2, 1, null]);
    expect(rows[2].active.slice(0, 3)).toEqual([0, 0, 1]);
  });

  it("weights retention by cohort size", () => {
    const rows = cohortTable(people, "2026-11-09");
    expect(weightedRetention(rows, 1)).toEqual({ active: 1, size: 3 });
    expect(weightedRetention(rows, 2)).toEqual({ active: 1, size: 1 });
  });

  it("splits each week's active people", () => {
    const [week] = composition(people, ["2026-11-09"]);
    expect(week).toEqual({ week: "2026-11-09", newPeople: 0, returning: 1, cameBack: 2, droppedOff: 1 });
    expect(composition(people, ["2026-11-02"])[0]).toMatchObject({ newPeople: 2 });
  });
});

describe("health", () => {
  const today = "2026-11-18";
  const org = { seats: 10, activeLastWeek: 5, trend: 0, lastActivity: "2026-11-17" };

  it("is red when idle for 14 days or under 10% of seats", () => {
    expect(health({ ...org, lastActivity: "2026-11-04" }, today)).toBe("red");
    expect(health({ ...org, lastActivity: "2026-11-05" }, today)).toBe("green");
    expect(health({ ...org, lastActivity: null }, today)).toBe("red");
    expect(health({ ...org, activeLastWeek: 0 }, today)).toBe("red");
  });

  it("is amber under 30% of seats or 20% below its average", () => {
    expect(health({ ...org, activeLastWeek: 2 }, today)).toBe("amber");
    expect(health({ ...org, trend: -0.25 }, today)).toBe("amber");
    expect(health({ ...org, activeLastWeek: 3 }, today)).toBe("green");
  });

  it("compares last week with the 4-week mean", () => {
    expect(trend([2, 2, 2, 2])).toBe(0);
    expect(trend([4, 4, 4, 0])).toBe(-1);
    expect(trend([0, 0, 0, 0])).toBeNull();
  });
});

describe("markers", () => {
  it("marks each Knowledge Champions send, once its day has come", () => {
    const label = "Knowledge Champions email";
    const now = markers(derivePeriod("2026-11-18", 26)).filter((m) => m.label === label);
    expect(now).toEqual([{ index: 18, label }]); // week of 28 Sep holds 1 Oct
    // 1 Jan's week has started, but the send hasn't happened yet
    expect(markers(derivePeriod("2026-12-30", 26)).filter((m) => m.label === label)).toHaveLength(1);
    expect(markers(derivePeriod("2027-01-01", 26)).filter((m) => m.label === label)).toHaveLength(2);
  });
});
