import type { CallResult, McpClientPool, ToolDescriptor } from "@gsa/mcp-client";
import { type Shield, type StepContext, formatDecision } from "@sarthak/agent-shield";
import { type RunContext, toPolicyRequest } from "./governance.js";
import type { ChatModel, CompletionResult, ToolSchema } from "./llm/types.js";

/** The slice of McpClientPool the steps need; lets tests pass a stub. */
export interface ToolGateway {
  callTool(server: string, tool: string, args?: Record<string, unknown>): Promise<CallResult>;
  listAllTools(): Promise<Record<string, ToolDescriptor[]>>;
}

export interface AgentDeps {
  shield: Shield;
  gateway: ToolGateway | McpClientPool;
  llm: ChatModel;
}

export interface Classification {
  category: string;
  customerFacing: boolean;
  summary: string;
}
export interface PlannedAction {
  server: string;
  tool: string;
  args: Record<string, unknown>;
  customerFacing: boolean;
}
export interface Plan {
  actions: PlannedAction[];
  summary: string;
}
export type ActionDisposition = "allow" | "needs-approval" | "refuse";
export interface PolicyJudgement {
  tool: string;
  disposition: ActionDisposition;
  reason: string;
  asiIds: string[];
}
export interface PolicyOutcome {
  judgements: PolicyJudgement[];
  refused: boolean;
}
export interface ApprovalOutcome {
  state: "not-required" | "required" | "approved" | "rejected";
}
export interface ExecutionOutcome {
  results: { tool: string; ok: boolean }[];
}

export interface RunState {
  runId: string;
  ticketId: string;
  classification?: Classification;
  plan?: Plan;
  policy?: PolicyOutcome;
  approval?: ApprovalOutcome;
  execution?: ExecutionOutcome;
}

export class PolicyRefusalError extends Error {
  constructor(
    readonly tool: string,
    readonly summary: string,
  ) {
    super(`refused ${tool}: ${summary}`);
    this.name = "PolicyRefusalError";
  }
}

const CUSTOMER_FACING_TOOLS = new Set(["replyPublic", "sendEmail"]);
const isCustomerFacing = (tool: string): boolean => CUSTOMER_FACING_TOOLS.has(tool);

// gpt-4o-mini list pricing (USD per token). Rough but enough to feed the breaker.
const COST_PER_PROMPT_TOKEN = 0.15 / 1_000_000;
const COST_PER_COMPLETION_TOKEN = 0.6 / 1_000_000;

function observeCompletion(deps: AgentDeps, ctx: StepContext, completion: CompletionResult): void {
  const costUsd =
    completion.usage.promptTokens * COST_PER_PROMPT_TOKEN +
    completion.usage.completionTokens * COST_PER_COMPLETION_TOKEN;
  deps.shield.config.breaker.observe({ costUsd });
  deps.shield.audit({
    ts: new Date().toISOString(),
    runId: ctx.runId,
    stepId: ctx.stepId,
    kind: "llm.completion",
    payload: {
      model: completion.model,
      responseModel: completion.model,
      system: "openai",
      inputTokens: completion.usage.promptTokens,
      outputTokens: completion.usage.completionTokens,
      costUsd,
    },
  });
}

/** Authorize a tool call against Cedar, then dispatch it through the scope-checked pool. */
async function governedCall(
  deps: AgentDeps,
  ctx: StepContext,
  server: string,
  tool: string,
  args: Record<string, unknown>,
  runCtx: RunContext = {},
): Promise<CallResult> {
  const decision = deps.shield.authorize(toPolicyRequest(server, tool, args, runCtx));
  deps.shield.audit({
    ts: new Date().toISOString(),
    runId: ctx.runId,
    stepId: ctx.stepId,
    kind: "policy.decision",
    payload: { server, tool, decision: decision.decision },
    decision,
  });
  if (decision.decision === "deny") {
    throw new PolicyRefusalError(tool, formatDecision(decision).summary);
  }
  deps.shield.config.breaker.observe({ toolCall: { name: tool, argsHash: stableHash(args) } });
  return deps.gateway.callTool(server, tool, args);
}

// ---- Phase logic. Each is wrapped by shield.wrap() by the caller, so kill /
// breaker / step.start|end audit happen around it automatically. ----

const CLASSIFY_SYSTEM =
  "You are a support-ops triage agent. Classify the ticket. Respond with ONLY a JSON object: " +
  '{"category": string, "customerFacing": boolean, "summary": string}. ' +
  "customerFacing is true only if resolving requires contacting the customer directly.";

export function classifyStep(deps: AgentDeps) {
  return async (state: RunState, ctx: StepContext): Promise<RunState> => {
    const ticket = (await governedCall(deps, ctx, "zendesk", "getTicket", { id: state.ticketId }))
      .data;
    const completion = await deps.llm.complete({
      messages: [
        { role: "system", content: CLASSIFY_SYSTEM },
        { role: "user", content: JSON.stringify(ticket) },
      ],
      temperature: 0,
      maxTokens: 200,
    });
    observeCompletion(deps, ctx, completion);
    return { ...state, classification: parseClassification(completion.content) };
  };
}

const PLAN_SYSTEM =
  "You are a support-ops agent. Using the ticket and the knowledge-base hits, decide how to resolve it. " +
  "Prefer resolving internally: draft an internal note (replyInternal) summarizing the answer for the support team. " +
  "Only use replyPublic if the customer must be contacted directly. Call the tools you intend to take.";

const ACTION_TOOLS: ToolSchema[] = [
  {
    name: "replyInternal",
    description:
      "Post an internal note visible only to support staff. Does not contact the customer.",
    parameters: {
      type: "object",
      properties: { ticketId: { type: "string" }, text: { type: "string" } },
      required: ["ticketId", "text"],
    },
  },
  {
    name: "replyPublic",
    description: "Send a customer-visible reply. Requires human approval; use sparingly.",
    parameters: {
      type: "object",
      properties: { ticketId: { type: "string" }, text: { type: "string" } },
      required: ["ticketId", "text"],
    },
  },
  {
    name: "closeTicket",
    description: "Close the ticket once resolved.",
    parameters: {
      type: "object",
      properties: { ticketId: { type: "string" } },
      required: ["ticketId"],
    },
  },
];

export function triageStep(deps: AgentDeps) {
  return async (state: RunState, ctx: StepContext): Promise<RunState> => {
    const query = state.classification?.summary ?? state.ticketId;
    const kb = (await governedCall(deps, ctx, "notion", "search", { query, tag: "support-kb" }))
      .data;

    const completion = await deps.llm.complete({
      messages: [
        { role: "system", content: PLAN_SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            ticketId: state.ticketId,
            classification: state.classification,
            kb,
          }),
        },
      ],
      tools: ACTION_TOOLS,
      toolChoice: "auto",
      temperature: 0,
      maxTokens: 400,
    });
    observeCompletion(deps, ctx, completion);

    const actions: PlannedAction[] = completion.toolCalls.map((tc) => ({
      server: "zendesk",
      tool: tc.name,
      args: { ticketId: state.ticketId, ...tc.args },
      customerFacing: isCustomerFacing(tc.name),
    }));
    return {
      ...state,
      plan: { actions, summary: completion.content || `${actions.length} action(s) proposed` },
    };
  };
}

export function policyCheckStep(deps: AgentDeps) {
  return async (state: RunState, ctx: StepContext): Promise<RunState> => {
    const judgements: PolicyJudgement[] = [];
    let refused = false;

    for (const action of state.plan?.actions ?? []) {
      const decision = deps.shield.authorize(
        toPolicyRequest(action.server, action.tool, action.args, { humanApprovalState: "pending" }),
      );
      deps.shield.audit({
        ts: new Date().toISOString(),
        runId: ctx.runId,
        stepId: ctx.stepId,
        kind: "policy.decision",
        payload: { tool: action.tool, decision: decision.decision },
        decision,
      });
      const formatted = formatDecision(decision);
      const disposition = dispositionOf(decision.decision, action.customerFacing);
      if (disposition === "refuse") refused = true;
      judgements.push({
        tool: action.tool,
        disposition,
        reason: formatted.summary,
        asiIds: formatted.asiIds,
      });
    }
    return { ...state, policy: { judgements, refused } };
  };
}

export function approvalGateStep(_deps: AgentDeps) {
  return async (state: RunState): Promise<RunState> => {
    const needsApproval = state.policy?.judgements.some((j) => j.disposition === "needs-approval");
    return { ...state, approval: { state: needsApproval ? "required" : "not-required" } };
  };
}

export function executeStep(deps: AgentDeps) {
  return async (state: RunState, ctx: StepContext): Promise<RunState> => {
    const results: { tool: string; ok: boolean }[] = [];
    if (state.policy?.refused) {
      return { ...state, execution: { results } };
    }
    const approved = state.approval?.state === "approved";
    const judgementByTool = new Map(state.policy?.judgements.map((j) => [j.tool, j]) ?? []);

    for (const action of state.plan?.actions ?? []) {
      const disposition = judgementByTool.get(action.tool)?.disposition;
      // Execute allowed actions now; approved customer-facing actions only if a
      // human approved. Skip anything still gated.
      const runnable = disposition === "allow" || (disposition === "needs-approval" && approved);
      if (!runnable) continue;
      const res = await governedCall(deps, ctx, action.server, action.tool, action.args, {
        humanApprovalState: approved ? "approved" : "pending",
      });
      results.push({ tool: action.tool, ok: !res.isError });
    }
    return { ...state, execution: { results } };
  };
}

export function auditStep(deps: AgentDeps) {
  return async (state: RunState, ctx: StepContext): Promise<RunState> => {
    deps.shield.audit({
      ts: new Date().toISOString(),
      runId: ctx.runId,
      stepId: ctx.stepId,
      kind: "run.summary",
      payload: {
        ticketId: state.ticketId,
        category: state.classification?.category,
        refused: state.policy?.refused ?? false,
        executed: state.execution?.results.map((r) => r.tool) ?? [],
      },
    });
    return state;
  };
}

/**
 * Run the support-ops phases in-process (no Mastra runtime), each wrapped by the
 * shield. This is the deterministic engine the unit tests drive; the Mastra
 * workflow in workflow.ts wraps the same phase functions for the durable path.
 */
export async function runSupportOps(deps: AgentDeps, input: RunState): Promise<RunState> {
  const phases: Array<[string, (s: RunState, c: StepContext) => Promise<RunState>]> = [
    ["ingest", classifyStep(deps)],
    ["triage", triageStep(deps)],
    ["policy-check", policyCheckStep(deps)],
    ["approval-gate", approvalGateStep(deps)],
    ["execute", executeStep(deps)],
    ["audit", auditStep(deps)],
  ];
  let state = input;
  for (const [stepId, fn] of phases) {
    state = await deps.shield.wrap(fn)(state, { runId: input.runId, stepId });
  }
  return state;
}

// ---- helpers ----

function dispositionOf(decision: "allow" | "deny", customerFacing: boolean): ActionDisposition {
  if (decision === "allow") return "allow";
  // A denied customer-facing action is the approval path (policy 05); a denied
  // internal action is a hard refusal (policy 06/07/default-deny).
  return customerFacing ? "needs-approval" : "refuse";
}

function parseClassification(text: string): Classification {
  const fallback: Classification = { category: "unknown", customerFacing: false, summary: "" };
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    const obj = JSON.parse(match[0]) as Partial<Classification>;
    return {
      category: typeof obj.category === "string" ? obj.category : fallback.category,
      customerFacing: obj.customerFacing === true,
      summary: typeof obj.summary === "string" ? obj.summary : fallback.summary,
    };
  } catch {
    return fallback;
  }
}

function stableHash(args: Record<string, unknown>): string {
  return JSON.stringify(args, Object.keys(args).sort());
}
