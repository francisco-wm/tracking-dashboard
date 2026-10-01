import { describe, expect, it } from "vitest";

import { assertAllowedProjectId, parseEnv } from "./environments";

describe("parseEnv", () => {
  it("defaults to production when missing", () => {
    expect(parseEnv(undefined)).toBe("production");
  });

  it("accepts the two known environments", () => {
    expect(parseEnv("production")).toBe("production");
    expect(parseEnv("staging")).toBe("staging");
  });

  it("rejects anything else, including raw project IDs", () => {
    expect(parseEnv("60292")).toBeNull();
    expect(parseEnv("Production")).toBeNull();
    expect(parseEnv("")).toBeNull();
    expect(parseEnv(["staging", "production"])).toBeNull();
  });
});

describe("assertAllowedProjectId", () => {
  it("allows production and staging", () => {
    expect(() => assertAllowedProjectId(60292)).not.toThrow();
    expect(() => assertAllowedProjectId(55666)).not.toThrow();
  });

  it("rejects every other project", () => {
    expect(() => assertAllowedProjectId(1)).toThrow(/not allowed/);
  });
});
