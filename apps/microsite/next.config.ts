import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // @gsa/policies reads its .cedar files from disk via import.meta.url. Keeping it
  // external (not bundled) preserves that path resolution so the page renders the
  // exact policy files the agent enforces.
  serverExternalPackages: ["@gsa/policies"],
};

export default config;
