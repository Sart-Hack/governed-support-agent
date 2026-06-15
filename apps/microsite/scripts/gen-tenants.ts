import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTenantProof } from "../app/lib/tenants";

// Precompute the tenant-isolation proof from the real Cedar policies in plain
// Node, where cedar-wasm resolves cleanly. The /tenants page reads the emitted
// JSON so it ships no WASM and stays fully static. tenants-data.test.ts re-runs
// the evaluation and asserts equality, so the committed JSON cannot drift.
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "lib", "tenants-data.json");
writeFileSync(out, `${JSON.stringify(getTenantProof(), null, 2)}\n`);
console.log("wrote", out);
