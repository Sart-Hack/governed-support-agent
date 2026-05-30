import type { ServerDef } from "@gsa/mcp-server-base";
import { type ZendeskState, createState, tools } from "./tools.js";

export interface ZendeskServerBundle {
  def: ServerDef;
  state: ZendeskState;
}

export function createZendeskServer(): ZendeskServerBundle {
  const state = createState();
  const def: ServerDef = {
    name: "gsa-mcp-server-zendesk",
    version: "0.0.0",
    description: "Mock Zendesk MCP server backed by @gsa/fixtures.",
    tools: tools(state),
  };
  return { def, state };
}
