// A minimal, provider-neutral chat-model surface. The agent talks to this, not
// to Bifrost directly, so the workflow runs identically against the live gateway
// (BifrostChatModel) and a deterministic stub (ScriptedChatModel) in tests.

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Present on assistant turns that proposed tool calls. */
  toolCalls?: ToolCall[];
  /** Present on tool-result turns; ties the result to the proposing call. */
  toolCallId?: string;
}

/** An OpenAI-style function tool the model may call. */
export interface ToolSchema {
  name: string;
  description: string;
  /** JSON Schema for the arguments object. */
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  /** Parsed arguments object (already JSON-decoded). */
  args: Record<string, unknown>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CompletionResult {
  /** Assistant text, empty string when the turn is purely tool calls. */
  content: string;
  toolCalls: ToolCall[];
  usage: TokenUsage;
  /** The model id that actually served the request, for the trace. */
  model: string;
}

export interface CompletionOptions {
  messages: ChatMessage[];
  tools?: ToolSchema[];
  /** "auto" lets the model decide whether to call a tool; "none" forbids it. */
  toolChoice?: "auto" | "none";
  temperature?: number;
  maxTokens?: number;
}

export interface ChatModel {
  /** Display id for traces, e.g. "openai/gpt-4o-mini" or "scripted". */
  readonly id: string;
  complete(opts: CompletionOptions): Promise<CompletionResult>;
}
