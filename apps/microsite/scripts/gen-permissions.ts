import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPermissionMatrix } from "../app/lib/permissions";

// Precompute the permission matrix from the real Cedar policies in plain Node,
// where the cedar-wasm evaluator resolves cleanly. The /permissions page reads
// the emitted JSON so the page itself ships no WASM and stays fully static. The
// committed JSON is kept honest by permissions-data.test.ts, which re-evaluates
// the policies and asserts equality.
const out = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "app",
  "lib",
  "permissions-data.json",
);
writeFileSync(out, `${JSON.stringify(getPermissionMatrix(), null, 2)}\n`);
console.log("wrote", out);
