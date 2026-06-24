import { describe, expect, it } from "vitest";
import { getInjectionProof } from "./injection-proof";
import data from "./injection-proof.json";

describe("injection-proof.json", () => {
  it("matches a fresh detector run (regenerate with pnpm gen:injection)", () => {
    expect(data).toEqual(getInjectionProof());
  });

  it("is a real detection on the payload fixture, mapped to ASI01", () => {
    const proof = getInjectionProof();
    expect(proof.detected).toBe(true);
    expect(proof.asi).toBe("ASI01 Agent Goal Hijack");
    expect(proof.pageId).toBe("NTP-KB-5");
    expect(proof.score).toBeGreaterThanOrEqual(proof.threshold);
    // The payload trips instruction-override and approval-bypass at minimum.
    expect(proof.signatures).toContain("instruction-override");
    expect(proof.signatures).toContain("control-bypass");
  });
});
