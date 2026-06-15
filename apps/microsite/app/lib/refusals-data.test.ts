import { describe, expect, it } from "vitest";
import { getRefusalScenes } from "./refusals";
import data from "./refusals-data.json";

describe("refusals-data.json", () => {
  it("matches a fresh Cedar evaluation (regenerate with pnpm gen:refusals)", () => {
    expect(data).toEqual(getRefusalScenes());
  });

  it("every scene is a real deny with a distinct ASI mapping", () => {
    const scenes = getRefusalScenes();
    expect(scenes.length).toBeGreaterThanOrEqual(4);
    for (const s of scenes) {
      expect(s.decision).toBe("deny");
      expect(s.formatted.summary).toMatch(/^Denied:/);
    }
    const asis = scenes.map((s) => s.asi);
    expect(new Set(asis).size).toBe(asis.length);
  });

  it("forbid scenes carry the policy in the reason chain; default-deny scenes do not", () => {
    const scenes = getRefusalScenes();
    const del = scenes.find((s) => s.id === "delete-account");
    const pii = scenes.find((s) => s.id === "pii-leak");
    expect(del?.denialKind).toBe("forbid");
    expect(del?.formatted.reasonLines.join(" ")).toMatch(/06-delete-account-never/);
    expect(pii?.denialKind).toBe("default-deny");
    expect(pii?.formatted.reasonLines).toEqual([]);
  });
});
