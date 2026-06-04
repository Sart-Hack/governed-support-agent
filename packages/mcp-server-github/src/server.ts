import type { ServerDef } from "@gsa/mcp-server-base";
import { type GithubState, createState, tools } from "./tools.js";

export interface GithubServerBundle {
  def: ServerDef;
  state: GithubState;
}

export function createGithubServer(env: NodeJS.ProcessEnv = process.env): GithubServerBundle {
  const state = createState(env);
  const def: ServerDef = {
    name: "gsa-mcp-server-github",
    version: "0.0.0",
    description:
      "GitHub Issues MCP server. Real GitHub API when GITHUB_TOKEN is set, mock otherwise.",
    tools: tools(state),
  };
  return { def, state };
}
