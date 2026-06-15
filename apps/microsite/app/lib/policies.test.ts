import { describe, expect, it } from "vitest";
import { getPolicies } from "./policies";

describe("getPolicies", () => {
  const policies = getPolicies();

  it("loads all eight enforced policies", () => {
    expect(policies).toHaveLength(8);
  });

  it("derives a valid ASI id and name for every policy from the .cedar annotations", () => {
    for (const policy of policies) {
      expect(policy.asiId).toMatch(/^ASI\d{2}$/);
      expect(policy.asiName.length).toBeGreaterThan(0);
      expect(policy.description.length).toBeGreaterThan(0);
    }
  });

  it("reads the permit/forbid effect from the policy body", () => {
    const byNum = Object.fromEntries(policies.map((p) => [p.num, p.effect]));
    expect(byNum["01"]).toBe("permit");
    expect(byNum["05"]).toBe("forbid");
    expect(byNum["06"]).toBe("forbid");
    expect(byNum["07"]).toBe("forbid");
    expect(byNum["08"]).toBe("permit");
  });

  it("prettifies titles with acronyms intact", () => {
    const byNum = Object.fromEntries(policies.map((p) => [p.num, p.title]));
    expect(byNum["03"]).toContain("PII");
    expect(byNum["04"]).toContain("GitHub");
    expect(byNum["01"]).toBe("Zendesk read only");
  });

  it("keeps the raw .cedar source so the page shows the enforced file", () => {
    const first = policies[0];
    expect(first?.text).toContain('@id("01-zendesk-read-only")');
    expect(first?.text).toContain("permit");
  });
});
