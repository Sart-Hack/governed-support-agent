import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { serverFactory } from "./server.js";
import type { ServerDef } from "./types.js";

export interface HttpOptions {
  host?: string;
  port: number;
  /** URL path the MCP transport listens on. Defaults to "/mcp". */
  path?: string;
}

export interface HttpHandle {
  port: number;
  close(): Promise<void>;
}

export async function runHttp(def: ServerDef, opts: HttpOptions): Promise<HttpHandle> {
  const factory = serverFactory(def);
  const path = opts.path ?? "/mcp";
  const host = opts.host ?? "0.0.0.0";

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname !== path) {
      respondNotFound(res, path);
      return;
    }
    if (
      req.method === "GET" &&
      url.pathname === path &&
      req.headers.accept?.includes("text/html")
    ) {
      respondLanding(res, def, path);
      return;
    }
    if (req.method !== "POST") {
      respondMethodNotAllowed(res);
      return;
    }
    try {
      await handlePost(factory, req, res);
    } catch (err) {
      handleError(res, err);
    }
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(opts.port, host, () => resolve());
  });

  const actualPort =
    typeof httpServer.address() === "object" && httpServer.address() !== null
      ? (httpServer.address() as { port: number }).port
      : opts.port;

  process.stderr.write(
    `[${def.name}] http transport ready on http://${host}:${actualPort}${path}\n`,
  );

  return {
    port: actualPort,
    close: () =>
      new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      }),
  };
}

async function handlePost(
  factory: ReturnType<typeof serverFactory>,
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

function respondNotFound(res: ServerResponse, path: string): void {
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "no MCP endpoint at this path", expected: path }));
}

function respondMethodNotAllowed(res: ServerResponse): void {
  res.writeHead(405, { "content-type": "application/json", allow: "POST" });
  res.end(JSON.stringify({ error: "method not allowed; use POST" }));
}

function respondLanding(res: ServerResponse, def: ServerDef, path: string): void {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(
    `${def.name} ${def.version}\nMCP Streamable HTTP transport.\nPOST ${path} with JSON-RPC.\nTools: ${def.tools.map((t) => t.name).join(", ")}\n`,
  );
}

function handleError(res: ServerResponse, err: unknown): void {
  process.stderr.write(`mcp http error: ${String(err)}\n`);
  if (!res.headersSent) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: String(err) }));
  }
}
