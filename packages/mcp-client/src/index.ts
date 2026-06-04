export {
  GovernedMcpClient,
  ScopeDeniedError,
  UnknownToolError,
  connectMcpClient,
} from "./client.js";
export { McpClientPool } from "./pool.js";
export type { McpClientPoolConfig } from "./pool.js";
export { defaultMcpTargets } from "./targets.js";
export { REQUIRED_SCOPES_META_KEY } from "./types.js";
export type {
  CallResult,
  GovernedMcpClientConfig,
  McpServerTarget,
  ToolDescriptor,
} from "./types.js";
