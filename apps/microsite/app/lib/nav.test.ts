import { describe, expect, it } from "vitest";
import { AUDIT_SAMPLE, TONE_DOT } from "./audit-sample";
import { NAV_ITEMS, NAV_SECTIONS, isActive } from "./nav";

describe("nav", () => {
  it("exposes every Phase 3 route exactly once", () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    const expected = [
      "/",
      "/traces/scenario-1",
      "/refusals",
      "/policies",
      "/permissions",
      "/evals",
      "/architecture",
      "/run",
      "/shield",
      "/trust",
      "/tenants",
    ];
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.sort()).toEqual(expected.sort());
  });

  it("flattens NAV_SECTIONS into NAV_ITEMS", () => {
    const fromSections = NAV_SECTIONS.flatMap((s) => s.items.length);
    const total = fromSections.reduce((a, b) => a + b, 0);
    expect(NAV_ITEMS.length).toBe(total);
  });

  it("marks the overview active only on exact root", () => {
    const overview = { label: "Overview", href: "/" };
    expect(isActive("/", overview)).toBe(true);
    expect(isActive("/policies", overview)).toBe(false);
  });

  it("keeps Traces active across dynamic trace ids via activeMatch", () => {
    const traces = { label: "Traces", href: "/traces/scenario-1", activeMatch: "/traces" };
    expect(isActive("/traces/scenario-1", traces)).toBe(true);
    expect(isActive("/traces/scenario-2", traces)).toBe(true);
    expect(isActive("/policies", traces)).toBe(false);
  });

  it("matches a leaf route exactly and as a parent prefix", () => {
    const policies = { label: "Policies", href: "/policies" };
    expect(isActive("/policies", policies)).toBe(true);
    expect(isActive("/policies/01", policies)).toBe(true);
    expect(isActive("/permissions", policies)).toBe(false);
  });
});

describe("audit sample", () => {
  it("every event uses a known tone with a dot class", () => {
    for (const event of AUDIT_SAMPLE) {
      expect(TONE_DOT[event.tone]).toBeTruthy();
    }
  });

  it("includes both an allow and a deny decision", () => {
    const details = AUDIT_SAMPLE.map((e) => e.detail).join(" ");
    expect(details).toContain("allow");
    expect(details).toContain("DENY");
  });
});
