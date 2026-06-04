import type { ToolHandlerResult } from "./types.js";

/** A successful tool result: the payload serialized as a JSON text block. */
export function ok(payload: unknown): ToolHandlerResult {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

/**
 * An error tool result: `{ error: message, ...extra }` as a JSON text block with
 * `isError` set. `extra` carries machine-readable detail like a `code`.
 */
export function errorResult(message: string, extra?: Record<string, unknown>): ToolHandlerResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message, ...extra }) }],
    isError: true,
  };
}

/** A not-found error result. Convenience wrapper over {@link errorResult}. */
export function notFound(message: string): ToolHandlerResult {
  return errorResult(message);
}
