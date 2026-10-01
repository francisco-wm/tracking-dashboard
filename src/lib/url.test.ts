import { describe, expect, it } from "vitest";

import { hrefWith } from "./url";

describe("hrefWith", () => {
  it("keeps the current query string", () => {
    expect(hrefWith("/dashboards/kc/reach", { env: "staging" })).toBe("/dashboards/kc/reach?env=staging");
  });

  it("applies overrides and removes nulls", () => {
    expect(hrefWith("/d", { env: "staging", names: "1" }, { names: null })).toBe("/d?env=staging");
    expect(hrefWith("/d", { env: "staging" }, { env: "production" })).toBe("/d?env=production");
  });

  it("returns the bare path without params", () => {
    expect(hrefWith("/d", {})).toBe("/d");
  });
});
