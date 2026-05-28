import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/policy/index.ts", "src/audit/index.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: {
    compilerOptions: {
      incremental: false,
      composite: false,
    },
  },
  splitting: false,
  minify: false,
});
