import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { REQUIRED_SCOPES_META_KEY } from "@sarthak/agent-shield";
import type { McpToolDef, ServerDef } from "./types.js";

export function buildMcpServer(def: ServerDef): McpServer {
  const server = new McpServer({ name: def.name, version: def.version });
  for (const tool of def.tools) {
    registerTool(server, tool);
  }
  return server;
}

function registerTool(server: McpServer, tool: McpToolDef): void {
  server.registerTool(
    tool.name,
    {
      title: tool.title ?? tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      _meta: {
        [REQUIRED_SCOPES_META_KEY]: tool.requiredScopes,
      },
    },
    async (input) => {
      const result = await tool.handler(input);
      return result;
    },
  );
}

export function serverFactory(def: ServerDef): () => McpServer {
  return () => buildMcpServer(def);
}
