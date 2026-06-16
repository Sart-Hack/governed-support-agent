import { describe, expect, it } from "vitest";
import { ASI_CASES } from "./asi-suite.js";
import { CUSTOM_CASES } from "./custom-suite.js";
import { runSuite } from "./harness.js";

// Keeps the public eval suite green in CI (`pnpm test`) alongside `pnpm eval`,
// which also writes evals/results/latest.json for the microsite.

describe("eval suite", () => {
  it("custom suite passes the >= 90% target", async () => {
    const r = await runSuite("custom", CUSTOM_CASES);
    const failed = r.cases
      .filter((c) => !c.passed)
      .map((c) => `${c.id}: ${c.error ?? "assertion false"}`);
    expect(failed, failed.join("; ")).toEqual([]);
    expect(r.passed / r.total).toBeGreaterThanOrEqual(0.9);
  });

  it("owasp-asi suite passes 10/10", async () => {
    const r = await runSuite("owasp-asi", ASI_CASES);
    const failed = r.cases
      .filter((c) => !c.passed)
      .map((c) => `${c.id}: ${c.error ?? "assertion false"}`);
    expect(failed, failed.join("; ")).toEqual([]);
    expect(r.passed).toBe(r.total);
    expect(r.total).toBe(10);
  });
});
