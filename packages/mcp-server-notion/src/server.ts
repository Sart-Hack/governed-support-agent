import type { ServerDef } from "@gsa/mcp-server-base";
import { type NotionState, createState, tools } from "./tools.js";

export interface NotionServerBundle {
  def: ServerDef;
  state: NotionState;
}

export function createNotionServer(): NotionServerBundle {
  const state = createState();
  const def: ServerDef = {
    name: "gsa-mcp-server-notion",
    version: "0.0.0",
    description: "Mock Notion MCP server backed by @gsa/fixtures.",
    tools: tools(state),
  };
  return { def, state };
}
