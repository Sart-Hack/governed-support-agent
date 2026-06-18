import { readFileSync, writeFileSync } from "node:fs";
import { detectInjection } from "@sarthak/agent-shield";

// Bridge for the InjecAgent Python sidecar: it cannot call the TypeScript
// detector directly, so it shells out here. Reads a JSON array of
// { id, content } from the input file and writes [{ id, detected }] to the
// output file, using the SAME detectInjection the agent runs at triage time —
// so the eval measures the real defense, with no reimplementation to drift.
//
// Usage: tsx injection-scan-cli.ts <inputPath> <outputPath>

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error("usage: injection-scan-cli.ts <inputPath> <outputPath>");
  process.exit(2);
}

const items = JSON.parse(readFileSync(inputPath, "utf8")) as { id: string; content: string }[];
const results = items.map((it) => ({
  id: it.id,
  detected: detectInjection(typeof it.content === "string" ? it.content : "").detected,
}));
writeFileSync(outputPath, JSON.stringify(results));
