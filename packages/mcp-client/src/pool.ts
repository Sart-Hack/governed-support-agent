import type { AuditSink, ScopeCheck } from "@sarthak/agent-shield";
import { type GovernedMcpClient, connectMcpClient } from "./client.js";
import type { CallResult, McpServerTarget, ToolDescriptor } from "./types.js";

export interface McpClientPoolConfig {
  targets: McpServerTarget[];
  /** Shared scope-check applied to every server in the pool. */
  scopeCheck?: ScopeCheck;
  audit?: AuditSink;
  runId?: string;
}

/**
 * A pool of governed MCP clients keyed by logical server name. This is what the
 * Mastra workflow steps hold: `pool.callTool("notion", "search", {...})`. Every
 * client shares one scope-check and audit sink, so the whole agent enforces a
 * single least-privilege grant across Zendesk, Notion, and HubSpot.
 */
export class McpClientPool {
  private constructor(private readonly clients: Map<string, GovernedMcpClient>) {}

  static async connect(config: McpClientPoolConfig): Promise<McpClientPool> {
    const settled = await Promise.all(
      config.targets.map(async (target) => {
        try {
          const client = await connectMcpClient({
            target,
            scopeCheck: config.scopeCheck,
            audit: config.audit,
            runId: config.runId,
          });
          return [target.name, client] as const;
        } catch (err) {
          // A single server being down should not break the whole agent — skip
          // it with a warning. Calling its tools later throws a clear error.
          process.stderr.write(
            `[mcp-client] could not connect "${target.name}" at ${target.url}: ${String(err)}\n`,
          );
          return null;
        }
      }),
    );
    return new McpClientPool(
      new Map(settled.filter((e): e is NonNullable<typeof e> => e !== null)),
    );
  }

  /** The governed client for a server, by logical name. */
  client(name: string): GovernedMcpClient {
    const client = this.clients.get(name);
    if (!client) {
      throw new Error(
        `no MCP client named "${name}" in pool; have [${[...this.clients.keys()].join(", ")}]`,
      );
    }
    return client;
  }

  /** Call a tool on a named server, gated by the shared scope-check. */
  callTool(server: string, tool: string, args?: Record<string, unknown>): Promise<CallResult> {
    return this.client(server).callTool(tool, args);
  }

  /** Discovered tools per server, for the permission matrix. */
  async listAllTools(): Promise<Record<string, ToolDescriptor[]>> {
    const out: Record<string, ToolDescriptor[]> = {};
    for (const [name, client] of this.clients) {
      out[name] = await client.listTools();
    }
    return out;
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.clients.values()].map((c) => c.close()));
  }
}
