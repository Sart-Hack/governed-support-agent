import type { McpServerTarget } from "./types.js";

/**
 * Default endpoints for the three mock MCP servers, matching the ports their
 * `bin/start.ts` bind (zendesk 7002, notion 7003, hubspot 7004). Overridable
 * per server via env so the same client works against host processes, Docker,
 * or a remote stack.
 */
export function defaultMcpTargets(env: NodeJS.ProcessEnv = process.env): McpServerTarget[] {
  return [
    { name: "zendesk", url: env.MCP_ZENDESK_URL ?? "http://localhost:7002/mcp" },
    { name: "notion", url: env.MCP_NOTION_URL ?? "http://localhost:7003/mcp" },
    { name: "hubspot", url: env.MCP_HUBSPOT_URL ?? "http://localhost:7004/mcp" },
    { name: "github", url: env.MCP_GITHUB_URL ?? "http://localhost:7005/mcp" },
  ];
}
