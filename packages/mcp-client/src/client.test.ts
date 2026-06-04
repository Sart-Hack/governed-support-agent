import { type HttpHandle, type ServerDef, runHttp } from "@gsa/mcp-server-base";
import { GrantedScopeCheck, InMemoryAuditSink } from "@sarthak/agent-shield";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { ScopeDeniedError, UnknownToolError, connectMcpClient } from "./client.js";
import { McpClientPool } from "./pool.js";

// A minimal two-tool server: one read tool, one write tool, each with a distinct
// scope — enough to exercise the scope-check gate in both directions.
const def: ServerDef = {
  name: "test-zendesk",
  version: "0.0.0",
  tools: [
    {
      name: "listTickets",
      description: "List tickets.",
      inputSchema: {},
      requiredScopes: ["zendesk:read"],
      handler: () => ({
        content: [{ type: "text" as const, text: JSON.stringify({ tickets: ["ZD-1"] }) }],
      }),
    },
    {
      name: "closeTicket",
      description: "Close a ticket.",
      inputSchema: { ticketId: z.string() },
      requiredScopes: ["zendesk:write"],
      handler: ({ ticketId }) => ({
        content: [{ type: "text" as const, text: JSON.stringify({ closed: ticketId }) }],
      }),
    },
  ],
};

let handle: HttpHandle;
let url: string;

beforeAll(async () => {
  handle = await runHttp(def, { port: 0, host: "127.0.0.1", path: "/mcp" });
  url = `http://127.0.0.1:${handle.port}/mcp`;
});

afterAll(async () => {
  await handle.close();
});

describe("GovernedMcpClient", () => {
  it("discovers tools with required scopes from _meta", async () => {
    const client = await connectMcpClient({ target: { name: "zendesk", url } });
    const tools = await client.listTools();
    expect(tools.find((t) => t.name === "listTickets")?.requiredScopes).toEqual(["zendesk:read"]);
    await client.close();
  });

  it("dispatches a tool the scope-check permits and parses JSON data", async () => {
    const client = await connectMcpClient({
      target: { name: "zendesk", url },
      scopeCheck: new GrantedScopeCheck(["zendesk:read"]),
    });
    const result = await client.callTool("listTickets", {});
    expect(result.isError).toBe(false);
    expect(result.data).toEqual({ tickets: ["ZD-1"] });
    await client.close();
  });

  it("denies a tool whose scope is not granted, before dispatch, and audits it", async () => {
    const audit = new InMemoryAuditSink();
    const client = await connectMcpClient({
      target: { name: "zendesk", url },
      scopeCheck: new GrantedScopeCheck(["zendesk:read"]),
      audit,
      runId: "test-run",
    });
    await expect(client.callTool("closeTicket", { ticketId: "ZD-1" })).rejects.toBeInstanceOf(
      ScopeDeniedError,
    );
    const denied = audit.list().filter((e) => e.kind === "scope.denied");
    expect(denied).toHaveLength(1);
    expect(denied[0]?.payload).toMatchObject({ tool: "closeTicket", server: "zendesk" });
    await client.close();
  });

  it("throws UnknownToolError for a tool the server does not expose", async () => {
    const client = await connectMcpClient({ target: { name: "zendesk", url } });
    await expect(client.callTool("nope")).rejects.toBeInstanceOf(UnknownToolError);
    await client.close();
  });
});

describe("McpClientPool", () => {
  it("routes calls to the named server through the shared scope-check", async () => {
    const pool = await McpClientPool.connect({
      targets: [{ name: "zendesk", url }],
      scopeCheck: new GrantedScopeCheck(["zendesk:read"]),
    });

    const ok = await pool.callTool("zendesk", "listTickets", {});
    expect(ok.isError).toBe(false);

    await expect(
      pool.callTool("zendesk", "closeTicket", { ticketId: "ZD-1" }),
    ).rejects.toBeInstanceOf(ScopeDeniedError);

    const all = await pool.listAllTools();
    expect((all.zendesk ?? []).map((t) => t.name)).toContain("listTickets");

    expect(() => pool.client("slack")).toThrow(/no MCP client named "slack"/);

    await pool.closeAll();
  });
});
