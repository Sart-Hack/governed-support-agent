import { type McpToolDef, errorResult, ok } from "@gsa/mcp-server-base";
import { z } from "zod";
import { type GitHubClient, createGitHubClient } from "./github-client.js";

export interface GithubState {
  client: GitHubClient;
}

export function createState(env: NodeJS.ProcessEnv = process.env): GithubState {
  return { client: createGitHubClient(env) };
}

export function tools(state: GithubState): McpToolDef[] {
  const createIssue: McpToolDef = {
    name: "createIssue",
    title: "Create a GitHub issue",
    description:
      "File an issue in the support repository. Real GitHub API when a token is configured; a deterministic mock otherwise.",
    inputSchema: {
      title: z.string().min(1).describe("Issue title."),
      body: z.string().default("").describe("Issue body (markdown)."),
      labels: z.array(z.string()).optional().describe("Labels to apply."),
      severity: z
        .enum(["P0", "P1", "P2", "P3"])
        .optional()
        .describe("Severity; P0 routes to humans (policy 04)."),
    },
    requiredScopes: ["github:issues:write"],
    handler: async ({ title, body, labels }) => {
      try {
        const issue = await state.client.createIssue(title, body ?? "", labels ?? []);
        return ok(issue);
      } catch (err) {
        return errorResult(String((err as Error).message), { code: "github_error" });
      }
    },
  };

  const updateIssue: McpToolDef = {
    name: "updateIssue",
    title: "Update a GitHub issue",
    description: "Update an issue's state or body in the support repository.",
    inputSchema: {
      issueNumber: z.number().int().positive().describe("Issue number to update."),
      state: z.enum(["open", "closed"]).optional(),
      body: z.string().optional(),
    },
    requiredScopes: ["github:issues:write"],
    handler: async ({ issueNumber, state: issueState, body }) => {
      try {
        const issue = await state.client.updateIssue(issueNumber, { state: issueState, body });
        return ok(issue);
      } catch (err) {
        return errorResult(String((err as Error).message), { code: "github_error" });
      }
    },
  };

  const listProjects: McpToolDef = {
    name: "listProjects",
    title: "List the configured repository",
    description: "Report the repository this server files issues against, and whether it is live.",
    inputSchema: {},
    requiredScopes: ["github:read"],
    handler: () => ok({ repo: state.client.slug, live: state.client.live }),
  };

  return [createIssue, updateIssue, listProjects];
}
