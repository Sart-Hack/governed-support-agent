import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { AllowAllScopeCheck, type AuditEvent } from "@sarthak/agent-shield";
import {
  type CallResult,
  type GovernedMcpClientConfig,
  REQUIRED_SCOPES_META_KEY,
  type ToolDescriptor,
} from "./types.js";

/** Thrown when the scope-check denies a tool before it is dispatched. */
export class ScopeDeniedError extends Error {
  constructor(
    readonly server: string,
    readonly tool: string,
    readonly requiredScopes: string[],
  ) {
    super(
      `scope check denied ${server}.${tool}; requires [${requiredScopes.join(", ")}] not granted`,
    );
    this.name = "ScopeDeniedError";
  }
}

/** Thrown when a tool is called that the server does not expose. */
export class UnknownToolError extends Error {
  constructor(
    readonly server: string,
    readonly tool: string,
  ) {
    super(`server "${server}" exposes no tool named "${tool}"`);
    this.name = "UnknownToolError";
  }
}

/**
 * An MCP client for one server with the agent-shield scope-check wired in as a
 * pre-dispatch gate. It discovers each tool's required scopes from the MCP
 * `_meta` field (spec-native scope discovery, not a custom header), and refuses
 * to call any tool the configured ScopeCheck does not permit — the call never
 * reaches the server. Every decision is mirrored to the audit sink.
 */
export class GovernedMcpClient {
  private readonly client: Client;
  private readonly transport: StreamableHTTPClientTransport;
  private readonly scopeCheck;
  private readonly audit;
  private readonly runId: string;
  private tools: Map<string, ToolDescriptor> | undefined;

  constructor(private readonly config: GovernedMcpClientConfig) {
    this.scopeCheck = config.scopeCheck ?? new AllowAllScopeCheck();
    this.audit = config.audit;
    this.runId = config.runId ?? "mcp-client";
    this.client = new Client(
      config.clientInfo ?? { name: `gsa-mcp-client/${config.target.name}`, version: "0.0.0" },
    );
    this.transport = new StreamableHTTPClientTransport(new URL(config.target.url));
  }

  get name(): string {
    return this.config.target.name;
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
  }

  /**
   * Discover tools and cache each tool's required scopes from `_meta`. The
   * result is memoized after the first call (and the eager call in
   * `connectMcpClient`), so the pool's permission-matrix build and the lazy
   * `callTool` path reuse it instead of re-hitting the wire. Pass `refresh` to
   * force a re-fetch.
   */
  async listTools(refresh = false): Promise<ToolDescriptor[]> {
    if (this.tools && !refresh) return [...this.tools.values()];
    const res = await this.client.listTools();
    const map = new Map<string, ToolDescriptor>();
    for (const tool of res.tools) {
      const meta = (tool as { _meta?: Record<string, unknown> })._meta;
      const raw = meta?.[REQUIRED_SCOPES_META_KEY];
      const requiredScopes = Array.isArray(raw) ? raw.map(String) : [];
      map.set(tool.name, {
        name: tool.name,
        description: tool.description,
        requiredScopes,
        inputSchema: tool.inputSchema as Record<string, unknown>,
      });
    }
    this.tools = map;
    return [...map.values()];
  }

  /**
   * Call a tool, gated by the scope-check. Throws UnknownToolError if the tool
   * is not exposed and ScopeDeniedError if the scope-check refuses it.
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<CallResult> {
    if (!this.tools) await this.listTools();
    const descriptor = this.tools?.get(name);
    if (!descriptor) throw new UnknownToolError(this.name, name);

    const required = { resource: this.name, scopes: descriptor.requiredScopes };
    const permitted = await this.scopeCheck.hasScopes(required);
    if (!permitted) {
      this.emit({
        kind: "scope.denied",
        payload: { server: this.name, tool: name, requiredScopes: descriptor.requiredScopes },
      });
      throw new ScopeDeniedError(this.name, name, descriptor.requiredScopes);
    }
    this.emit({
      kind: "scope.granted",
      payload: { server: this.name, tool: name, requiredScopes: descriptor.requiredScopes },
    });

    this.emit({ kind: "tool.call", payload: { server: this.name, tool: name, args } });
    const res = await this.client.callTool({ name, arguments: args });
    const content = (res.content ?? []) as { type: string; text?: string }[];
    const result: CallResult = {
      content,
      isError: res.isError === true,
      data: parseFirstText(content),
    };
    this.emit({
      kind: "tool.result",
      payload: { server: this.name, tool: name, isError: result.isError },
    });
    return result;
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  private emit(partial: Pick<AuditEvent, "kind" | "payload">): void {
    if (!this.audit) return;
    void this.audit.append({
      ts: new Date().toISOString(),
      runId: this.runId,
      stepId: this.name,
      ...partial,
    });
  }
}

function parseFirstText(content: { type: string; text?: string }[]): unknown {
  const first = content.find((c) => c.type === "text" && typeof c.text === "string");
  if (!first?.text) return undefined;
  try {
    return JSON.parse(first.text);
  } catch {
    return undefined;
  }
}

/** Connect a single governed MCP client and discover its tools. */
export async function connectMcpClient(
  config: GovernedMcpClientConfig,
): Promise<GovernedMcpClient> {
  const client = new GovernedMcpClient(config);
  await client.connect();
  await client.listTools();
  return client;
}
