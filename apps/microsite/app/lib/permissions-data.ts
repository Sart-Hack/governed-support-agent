import type { Matrix } from "./permissions";
import data from "./permissions-data.json";

// Build-time output of getPermissionMatrix() (real Cedar decisions), regenerated
// by `pnpm gen:permissions` and kept honest by permissions-data.test.ts. The page
// imports this instead of evaluating Cedar in the Next runtime, so it stays static
// and ships no WASM.
export const permissionMatrix = data as unknown as Matrix;
