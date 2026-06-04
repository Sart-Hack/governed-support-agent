import type { AuditSink, ScopeCheck } from "@sarthak/agent-shield";

// The `_meta` scope-discovery key is owned by agent-shield (the governance
// layer). Re-exported here so client code has it close at hand.
export { REQUIRED_SCOPES_META_KEY } from "@sarthak/agent-shield";

/** One MCP server the client can talk to. */
export interface McpServerTarget {
  /**
   * Logical name, e.g. "zendesk". Becomes the pool key and the `resource`
   * passed to the scope-check, so it should match the scope token prefix.
   */
  name: string;
  /** Streamable HTTP endpoint, e.g. "http://localhost:7002/mcp". */
  url: string;
}

/** A tool as discovered from a server, with its scope requirement resolved. */
export interface ToolDescriptor {
  name: string;
  description?: string;
  /** Scopes pulled from the tool's `_meta["agent-shield/requiredScopes"]`. */
  requiredScopes: string[];
  inputSchema?: Record<string, unknown>;
}

/** Normalised tool-call result. */
export interface CallResult {
  content: { type: string; text?: string }[];
  isError: boolean;
  /** First text block parsed as JSON when possible, else undefined. */
  data?: unknown;
}

export interface GovernedMcpClientConfig {
  target: McpServerTarget;
  /** Least-privilege gate run before every tool call. Defaults to allow-all. */
  scopeCheck?: ScopeCheck;
  /** Optional sink for scope.granted / scope.denied / tool.call / tool.result. */
  audit?: AuditSink;
  /** Run id stamped onto audit events. Defaults to "mcp-client". */
  runId?: string;
  clientInfo?: { name: string; version: string };
}
