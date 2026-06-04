import type { ChatModel, CompletionOptions, CompletionResult, ToolCall } from "./types.js";

export interface ScriptedTurn {
  content?: string;
  toolCalls?: ToolCall[];
}

/**
 * A deterministic ChatModel that replays a fixed sequence of turns. Lets the
 * workflow run end-to-end in tests and offline demos without any LLM credits,
 * exercising exactly the same code paths as BifrostChatModel.
 */
export class ScriptedChatModel implements ChatModel {
  readonly id = "scripted";
  private cursor = 0;
  readonly calls: CompletionOptions[] = [];

  constructor(private readonly script: ScriptedTurn[]) {}

  async complete(opts: CompletionOptions): Promise<CompletionResult> {
    this.calls.push(opts);
    const turn = this.script[this.cursor++] ?? {};
    return {
      content: turn.content ?? "",
      toolCalls: turn.toolCalls ?? [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: this.id,
    };
  }
}
