import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "bin/start.ts"],
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
    entry: ["src/index.ts"],
  },
  splitting: false,
  minify: false,
});
