import type { z } from "zod";

export type ToolHandlerResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export interface McpToolDef<S extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  title?: string;
  description: string;
  inputSchema: S;
  /**
   * Required OAuth-style scopes the caller's token must carry. Surfaced to the
   * client via the MCP spec's tool `_meta` field so callers can perform scope
   * discovery before invoking the tool. Used by agent-shield's scope-check.
   */
  requiredScopes: string[];
  handler: (input: z.infer<z.ZodObject<S>>) => Promise<ToolHandlerResult> | ToolHandlerResult;
}

export interface ServerDef {
  name: string;
  version: string;
  description?: string;
  tools: McpToolDef[];
}
