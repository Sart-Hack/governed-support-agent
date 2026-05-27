/**
 * Phase 2 / Spike 2 — MCP mock server fronting three named MCP clients.
 *
 * One Node HTTP process, three Streamable-HTTP MCP endpoints (one tool each):
 *   POST /mcp/zendesk  → list_tickets
 *   POST /mcp/notion   → search_docs
 *   POST /mcp/hubspot  → find_account
 *
 * Stateless mode: every POST gets a fresh McpServer + transport pair, cleaned
 * up on response close. This is the canonical pattern from the MCP TS SDK
 * `simpleStatelessStreamableHttp` example — reusing a single McpServer across
 * requests breaks `initialize` after the first call.
 *
 * Bifrost (running in docker) reaches this server via host.docker.internal:7001.
 * Spec compliance target: MCP 2025-06-18 (Streamable HTTP transport).
 *
 * Usage:
 *   pnpm --filter @gsa/agent spike:mcp:server
 */

import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const PORT = Number(process.env.SPIKE_MCP_PORT ?? 7001);
const HOST = process.env.SPIKE_MCP_HOST ?? "0.0.0.0";

type ServerFactory = () => McpServer;

function buildZendeskServer(): McpServer {
  const server = new McpServer({ name: "mock-zendesk", version: "0.0.1" });
  server.registerTool(
    "list_tickets",
    {
      title: "List Zendesk tickets",
      description: "Return open tickets, optionally filtered by status.",
      inputSchema: { status: z.string().optional() },
    },
    async ({ status }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify([
            { id: "TCK-42", subject: "Cannot access dashboard", status: status ?? "open" },
            { id: "TCK-77", subject: "Billing question", status: status ?? "open" },
          ]),
        },
      ],
    }),
  );
  return server;
}

function buildNotionServer(): McpServer {
  const server = new McpServer({ name: "mock-notion", version: "0.0.1" });
  server.registerTool(
    "search_docs",
    {
      title: "Search Notion docs",
      description: "Find internal docs matching a free-text query.",
      inputSchema: { query: z.string() },
    },
    async ({ query }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            query,
            results: ["Refund Policy v3", "SLA — Enterprise", "Onboarding Runbook"],
          }),
        },
      ],
    }),
  );
  return server;
}

function buildHubspotServer(): McpServer {
  const server = new McpServer({ name: "mock-hubspot", version: "0.0.1" });
  server.registerTool(
    "find_account",
    {
      title: "Find HubSpot account",
      description: "Look up a customer account by email domain.",
      inputSchema: { domain: z.string() },
    },
    async ({ domain }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            domain,
            plan: "Enterprise",
            arr_usd: 84000,
            csm: "alex@gsa-demo",
          }),
        },
      ],
    }),
  );
  return server;
}

const routes: Record<string, ServerFactory> = {
  "/mcp/zendesk": buildZendeskServer,
  "/mcp/notion": buildNotionServer,
  "/mcp/hubspot": buildHubspotServer,
};

async function handlePost(
  factory: ServerFactory,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const server = factory();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}

const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const factory = routes[url.pathname];
  console.log(`[spike-mcp] ${req.method} ${url.pathname}`);

  if (!factory) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error: "no MCP endpoint at this path",
        available: Object.keys(routes),
      }),
    );
    return;
  }

  if (req.method === "POST") {
    try {
      await handlePost(factory, req, res);
    } catch (err) {
      console.error(`[spike-mcp] ${url.pathname} POST error:`, err);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    }
    return;
  }

  res.writeHead(405, { "content-type": "application/json", allow: "POST" });
  res.end(JSON.stringify({ error: "method not allowed; use POST" }));
});

http.listen(PORT, HOST, () => {
  console.log(`[spike-mcp] listening on http://${HOST}:${PORT}`);
  for (const path of Object.keys(routes)) {
    console.log(`  ${path}`);
  }
  console.log("\nFrom Bifrost (docker), the reachable URLs are:");
  for (const path of Object.keys(routes)) {
    console.log(`  http://host.docker.internal:${PORT}${path}`);
  }
});

const shutdown = () => {
  console.log("\n[spike-mcp] shutting down");
  http.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
