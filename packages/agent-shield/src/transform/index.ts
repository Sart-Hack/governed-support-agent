import { type Redaction, redactPii } from "./redact.js";

export type { Redaction, RedactionResult } from "./redact.js";
export { redactPii } from "./redact.js";

export interface TransformResult {
  /** The transformed value (a deep clone; the input is never mutated). */
  value: unknown;
  /** What the transform changed, for audit evidence. Empty if nothing matched. */
  redactions: Redaction[];
}

/**
 * Run a named Cedar `responseTransform` over a tool result. The transform name
 * is the same token a policy's `when { context.responseTransform == ... }`
 * clause requires, so the policy and its enforcement stay in lockstep. Unknown
 * transforms are a no-op (the value passes through unchanged).
 */
export function applyResponseTransform(name: string, value: unknown): TransformResult {
  switch (name) {
    case "pii-redact":
      return redactPii(value);
    default:
      return { value, redactions: [] };
  }
}
