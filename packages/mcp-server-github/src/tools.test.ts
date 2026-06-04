import { describe, expect, it } from "vitest";
import { createGitHubClient } from "./github-client.js";
import { createState, tools } from "./tools.js";

function mockState() {
  return createState({} as NodeJS.ProcessEnv); // no GITHUB_TOKEN -> mock mode
}

function toolByName(name: string) {
  const t = tools(mockState()).find((x) => x.name === name);
  if (!t) throw new Error(`no tool ${name}`);
  return t;
}

function dataOf(result: { content: { text?: string }[] }) {
  return JSON.parse(result.content[0]?.text ?? "{}");
}

describe("@gsa/mcp-server-github (mock mode)", () => {
  it("runs in mock mode without a token", () => {
    expect(createGitHubClient({} as NodeJS.ProcessEnv).live).toBe(false);
  });

  it("createIssue returns a mock issue with a number and url", async () => {
    const res = await toolByName("createIssue").handler({ title: "Investigate 500s", body: "x" });
    const issue = dataOf(res);
    expect(issue.mock).toBe(true);
    expect(typeof issue.number).toBe("number");
    expect(issue.url).toContain("/issues/");
    expect(issue.title).toBe("Investigate 500s");
  });

  it("every tool advertises required scopes for discovery", () => {
    for (const t of tools(mockState())) {
      expect(t.requiredScopes.length).toBeGreaterThan(0);
    }
    expect(toolByName("createIssue").requiredScopes).toContain("github:issues:write");
  });

  it("listProjects reports the configured repo and live=false in mock mode", async () => {
    const res = await toolByName("listProjects").handler({});
    const data = dataOf(res);
    expect(data.live).toBe(false);
    expect(data.repo).toBe("demo-org/support");
  });

  it("createIssue mock numbers increment per server instance", async () => {
    const state = mockState();
    const [createIssue] = tools(state);
    const a = dataOf(await createIssue!.handler({ title: "a", body: "" }));
    const b = dataOf(await createIssue!.handler({ title: "b", body: "" }));
    expect(b.number).toBe(a.number + 1);
  });
});
