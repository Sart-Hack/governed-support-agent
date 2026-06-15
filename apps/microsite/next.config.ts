import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // @gsa/policies reads its .cedar files from disk via import.meta.url; agent-shield
  // loads the Cedar WASM evaluator. Keeping both external (not bundled) preserves
  // path resolution and the native module load, so the pages render the exact
  // policies the agent enforces and evaluate them through the real engine.
  serverExternalPackages: ["@gsa/policies", "@sarthak/agent-shield"],
};

export default config;
