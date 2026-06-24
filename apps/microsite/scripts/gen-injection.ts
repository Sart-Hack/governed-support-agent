import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getInjectionProof } from "../app/lib/injection-proof";

// Precompute the injection-card facts from the real fixture payload and the real
// agent-shield detector in plain Node, where the workspace packages resolve
// cleanly. The homepage reads the emitted JSON so it stays static and pulls no
// detector code into the Next build. injection-proof.test.ts re-runs the
// computation and asserts equality, so the committed facts cannot drift.
const out = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "app",
  "lib",
  "injection-proof.json",
);
writeFileSync(out, `${JSON.stringify(getInjectionProof(), null, 2)}\n`);
console.log("wrote", out);
