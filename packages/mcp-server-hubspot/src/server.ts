import type { ServerDef } from "@gsa/mcp-server-base";
import { type HubspotState, createState, tools } from "./tools.js";

export interface HubspotServerBundle {
  def: ServerDef;
  state: HubspotState;
}

export function createHubspotServer(): HubspotServerBundle {
  const state = createState();
  const def: ServerDef = {
    name: "gsa-mcp-server-hubspot",
    version: "0.0.0",
    description: "Mock HubSpot MCP server backed by @gsa/fixtures.",
    tools: tools(state),
  };
  return { def, state };
}
