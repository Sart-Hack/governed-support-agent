import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ASI_CASES } from "./asi-suite.js";
import { CUSTOM_CASES } from "./custom-suite.js";
import { type SuiteRun, runSuite } from "./harness.js";

// The public eval suite. Two suites run here, fully offline and deterministic:
//   custom    — scenario-derived assertions against the real policies + phases
//   owasp-asi — one assertion per OWASP Agentic Top 10 ID
// It writes evals/results/latest.json (read by the microsite /evals page) and a
// shields.io-compatible badge.json. The InjecAgent subset (a Python sidecar over
// the public benchmark) is a separate suite, not run here, so /evals shows it as
// pending rather than a fabricated number.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");
const OUT_DIR = join(REPO_ROOT, "evals", "results");

const CUSTOM_TARGET = 0.9; // >= 90%
const ASI_TARGET = 1; // 10 / 10

function printSuite(s: SuiteRun): void {
  console.log(`\n${s.suite}: ${s.passed}/${s.total}`);
  for (const c of s.cases) {
    const mark = c.passed ? "✓" : "✗";
    console.log(`  ${mark} ${c.id} — ${c.description}${c.error ? `  [${c.error}]` : ""}`);
  }
}

async function main(): Promise<void> {
  console.log("\n▸ Governed Support Ops Agent — eval suite (offline, deterministic)");

  const custom = await runSuite("custom", CUSTOM_CASES);
  const asi = await runSuite("owasp-asi", ASI_CASES);
  printSuite(custom);
  printSuite(asi);

  const customRate = custom.total === 0 ? 0 : custom.passed / custom.total;
  const customOk = customRate >= CUSTOM_TARGET;
  const asiRate = asi.total === 0 ? 0 : asi.passed / asi.total;
  const asiOk = asiRate >= ASI_TARGET;
  const allOk = customOk && asiOk;

  const results = {
    generatedAt: new Date().toISOString(),
    suites: [
      { suite: custom.suite, passed: custom.passed, total: custom.total },
      { suite: asi.suite, passed: asi.passed, total: asi.total },
    ],
  };
  const badge = {
    schemaVersion: 1,
    label: "evals",
    message: `custom ${custom.passed}/${custom.total} · asi ${asi.passed}/${asi.total}`,
    color: allOk ? "brightgreen" : "red",
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "latest.json"), `${JSON.stringify(results, null, 2)}\n`);
  writeFileSync(join(OUT_DIR, "badge.json"), `${JSON.stringify(badge, null, 2)}\n`);

  console.log("\n── targets ──");
  console.log(
    `  custom    : ${(customRate * 100).toFixed(0)}% (target ≥ 90%)  ${customOk ? "✓" : "✗"}`,
  );
  console.log(
    `  owasp-asi : ${asi.passed}/${asi.total} (target 10/10)        ${asiOk ? "✓" : "✗"}`,
  );
  console.log(`\n  wrote ${join("evals", "results", "latest.json")} + badge.json`);
  console.log("  injecagent: pending (Python sidecar over the public benchmark — not run here)\n");

  if (!allOk) process.exitCode = 1;
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (err) => {
    console.error("\n✗ eval error:", err);
    process.exit(1);
  },
);
