import { describe, expect, it } from "vitest";
import { AllowAllScopeCheck, GrantedScopeCheck } from "./index.js";

describe("AllowAllScopeCheck", () => {
  it("permits any required scopes", () => {
    const check = new AllowAllScopeCheck();
    expect(check.hasScopes({ resource: "zendesk", scopes: ["zendesk:delete"] })).toBe(true);
  });
});

describe("GrantedScopeCheck", () => {
  const check = new GrantedScopeCheck(["zendesk:read", "notion:search", "hubspot:read"]);

  it("permits a tool whose scopes are a subset of the grant", () => {
    expect(check.hasScopes({ resource: "zendesk", scopes: ["zendesk:read"] })).toBe(true);
  });

  it("permits a tool requiring multiple granted scopes", () => {
    expect(check.hasScopes({ resource: "notion", scopes: ["notion:search"] })).toBe(true);
  });

  it("denies a tool that requires any ungranted scope", () => {
    expect(check.hasScopes({ resource: "hubspot", scopes: ["hubspot:delete"] })).toBe(false);
  });

  it("denies when one of several required scopes is missing", () => {
    expect(
      check.hasScopes({ resource: "zendesk", scopes: ["zendesk:read", "zendesk:write"] }),
    ).toBe(false);
  });

  it("permits a tool that requires no scopes", () => {
    expect(check.hasScopes({ resource: "zendesk", scopes: [] })).toBe(true);
  });

  it("exposes the granted scopes for display", () => {
    expect(new GrantedScopeCheck(["a", "b"]).scopes().sort()).toEqual(["a", "b"]);
  });
});
