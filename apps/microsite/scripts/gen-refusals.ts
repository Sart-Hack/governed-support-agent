import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getRefusalScenes } from "../app/lib/refusals";

// Precompute the refusal scenes from the real Cedar policies in plain Node, where
// cedar-wasm resolves cleanly. The /refusals page reads the emitted JSON so it
// ships no WASM and stays static. refusals-data.test.ts re-runs the evaluation and
// asserts equality, so the committed verdicts cannot drift from the policies.
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "lib", "refusals-data.json");
writeFileSync(out, `${JSON.stringify(getRefusalScenes(), null, 2)}\n`);
console.log("wrote", out);
