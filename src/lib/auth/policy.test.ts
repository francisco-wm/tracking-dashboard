import { describe, expect, it } from "vitest";

import { isAllowedEmail, isAllowedGoogleProfile, safeCallbackPath } from "./policy";

describe("isAllowedEmail", () => {
  it("accepts wingmaite.com addresses, any case", () => {
    expect(isAllowedEmail("someone@wingmaite.com")).toBe(true);
    expect(isAllowedEmail("Someone@Wingmaite.com")).toBe(true);
  });

  it("rejects other domains and look-alikes", () => {
    expect(isAllowedEmail("someone@gmail.com")).toBe(false);
    expect(isAllowedEmail("someone@notwingmaite.com")).toBe(false);
    expect(isAllowedEmail("someone@wingmaite.com.evil.io")).toBe(false);
    expect(isAllowedEmail(undefined)).toBe(false);
  });
});

describe("isAllowedGoogleProfile", () => {
  const ok = { email: "someone@wingmaite.com", email_verified: true, hd: "wingmaite.com" };

  it("accepts a verified wingmaite Workspace account", () => {
    expect(isAllowedGoogleProfile(ok)).toBe(true);
  });

  it("rejects unverified emails", () => {
    expect(isAllowedGoogleProfile({ ...ok, email_verified: false })).toBe(false);
  });

  it("rejects accounts outside the wingmaite Workspace", () => {
    expect(isAllowedGoogleProfile({ ...ok, hd: undefined })).toBe(false);
    expect(isAllowedGoogleProfile({ ...ok, hd: "other.com" })).toBe(false);
  });

  it("rejects missing profiles", () => {
    expect(isAllowedGoogleProfile(null)).toBe(false);
  });
});

describe("safeCallbackPath", () => {
  it("keeps same-site paths", () => {
    expect(safeCallbackPath("/dashboards/knowledge-champions/questions?env=staging")).toBe(
      "/dashboards/knowledge-champions/questions?env=staging",
    );
  });

  it("keeps only the path of absolute URLs (Auth.js sends those)", () => {
    expect(safeCallbackPath("http://localhost:3000/dashboards/knowledge-champions/reach?env=staging")).toBe(
      "/dashboards/knowledge-champions/reach?env=staging",
    );
    expect(safeCallbackPath("https://evil.example/phish")).toBe("/phish");
  });

  it("falls back for protocol-relative or non-http values", () => {
    expect(safeCallbackPath("javascript:alert(1)")).toBe("/dashboards");
    expect(safeCallbackPath("//evil.example")).toBe("/dashboards");
    expect(safeCallbackPath("/\\evil.example")).toBe("/dashboards");
    expect(safeCallbackPath(undefined)).toBe("/dashboards");
  });
});
