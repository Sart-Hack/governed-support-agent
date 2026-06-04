import type { ChatModel, CompletionOptions, CompletionResult, ToolCall } from "./types.js";

export interface BifrostChatModelOptions {
  /** Bifrost base URL. Defaults to BIFROST_URL or http://localhost:8080. */
  baseUrl?: string;
  /** Provider-qualified model id, e.g. "openai/gpt-4o-mini". */
  model?: string;
}

interface OpenAiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAiChoice {
  message: { content: string | null; tool_calls?: OpenAiToolCall[] };
  finish_reason: string;
}

interface OpenAiResponse {
  choices: OpenAiChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model?: string;
  error?: { message: string };
}

/**
 * The live chat model: OpenAI-compatible chat completions routed through the
 * Bifrost gateway. This is the path that proves the agent calls Bifrost as its
 * LLM endpoint, including `tool_choice: auto` for model-proposed tool calls.
 */
export class BifrostChatModel implements ChatModel {
  readonly id: string;
  private readonly endpoint: string;

  constructor(opts: BifrostChatModelOptions = {}) {
    const baseUrl = opts.baseUrl ?? process.env.BIFROST_URL ?? "http://localhost:8080";
    this.id = opts.model ?? process.env.AGENT_MODEL ?? "openai/gpt-4o-mini";
    this.endpoint = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  }

  async complete(opts: CompletionOptions): Promise<CompletionResult> {
    const body: Record<string, unknown> = {
      model: this.id,
      messages: opts.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        ...(m.toolCalls
          ? {
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: JSON.stringify(tc.args) },
              })),
            }
          : {}),
      })),
      temperature: opts.temperature ?? 0,
      max_tokens: opts.maxTokens ?? 512,
    };
    if (opts.tools?.length) {
      body.tools = opts.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      body.tool_choice = opts.toolChoice ?? "auto";
    }

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as OpenAiResponse;
    if (!res.ok || json.error) {
      throw new Error(
        `Bifrost completion failed (${res.status}): ${json.error?.message ?? "unknown"}`,
      );
    }

    const choice = json.choices[0];
    if (!choice) throw new Error("Bifrost returned no choices");
    return {
      content: choice.message.content ?? "",
      toolCalls: parseToolCalls(choice.message.tool_calls),
      usage: {
        promptTokens: json.usage?.prompt_tokens ?? 0,
        completionTokens: json.usage?.completion_tokens ?? 0,
        totalTokens: json.usage?.total_tokens ?? 0,
      },
      model: json.model ?? this.id,
    };
  }
}

function parseToolCalls(raw: OpenAiToolCall[] | undefined): ToolCall[] {
  if (!raw?.length) return [];
  return raw.map((tc) => {
    let args: Record<string, unknown> = {};
    try {
      args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
    } catch {
      args = {};
    }
    return { id: tc.id, name: tc.function.name, args };
  });
}
