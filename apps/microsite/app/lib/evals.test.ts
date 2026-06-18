import { describe, expect, it } from "vitest";
import { ASI_COVERAGE, SUITES, loadEvalResults } from "./evals";
import { getPolicies } from "./policies";

describe("evals coverage", () => {
  it("covers all ten OWASP-ASI ids exactly once", () => {
    const ids = ASI_COVERAGE.map((a) => a.id);
    expect(ids).toEqual([
      "ASI01",
      "ASI02",
      "ASI03",
      "ASI04",
      "ASI05",
      "ASI06",
      "ASI07",
      "ASI08",
      "ASI09",
      "ASI10",
    ]);
  });

  it("every policy-backed ASI row names a real policy; full rows match its primary ASI", () => {
    const policies = getPolicies();
    const byFile = new Map(policies.map((p) => [p.filename, p]));
    for (const row of ASI_COVERAGE) {
      for (const file of row.policyFiles) {
        const policy = byFile.get(file);
        expect(policy, `policy file ${file} should exist`).toBeTruthy();
        // A "full" row is the policy's primary ASI. A "partial" row reuses a
        // policy whose primary ASI is different (e.g. ASI07 reuses policy 03,
        // primarily ASI04), so only assert the exact match for full rows.
        if (row.strength === "full") expect(policy?.asiId).toBe(row.id);
      }
    }
  });

  it("every ASI a policy enforces appears in the coverage map", () => {
    const coveredByPolicy = new Set(
      ASI_COVERAGE.filter((a) => a.policyFiles.length > 0).map((a) => a.id),
    );
    for (const p of getPolicies()) {
      expect(coveredByPolicy.has(p.asiId)).toBe(true);
    }
  });

  it("suites declare sane targets", () => {
    expect(SUITES).toHaveLength(3);
    for (const s of SUITES) {
      expect(s.targetRate).toBeGreaterThan(0);
      expect(s.targetRate).toBeLessThanOrEqual(1);
    }
  });

  it("loadEvalResults returns null when absent, or a well-formed results object once the suite has run", () => {
    // Phase 4 is shipped, so latest.json may or may not be present (it is gitignored:
    // absent in a clean checkout, written by `pnpm eval` / CI before the microsite
    // build). Either way the loader must honor its contract for the /evals page.
    const r = loadEvalResults();
    if (r === null) return; // absent: the page renders pending
    expect(typeof r.generatedAt).toBe("string");
    expect(Array.isArray(r.suites)).toBe(true);
    for (const s of r.suites) {
      expect(typeof s.suite).toBe("string");
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(s.passed).toBeGreaterThanOrEqual(0);
      expect(s.passed).toBeLessThanOrEqual(s.total);
    }
  });
});
