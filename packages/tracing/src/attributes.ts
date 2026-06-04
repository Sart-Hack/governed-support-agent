// Pinned, stable GenAI semantic-convention keys (per CLAUDE.md: pin
// gen_ai.request.*, gen_ai.usage.*, gen_ai.response.*). Langfuse v3 reads these
// to render a span as an LLM generation.
export const GEN_AI = {
  system: "gen_ai.system",
  operationName: "gen_ai.operation.name",
  requestModel: "gen_ai.request.model",
  requestTemperature: "gen_ai.request.temperature",
  requestMaxTokens: "gen_ai.request.max_tokens",
  responseModel: "gen_ai.response.model",
  usageInputTokens: "gen_ai.usage.input_tokens",
  usageOutputTokens: "gen_ai.usage.output_tokens",
} as const;

// Custom agent-governance attributes. agent.policy.decision.reasons is the
// human-readable Cedar reason chain (via formatDecision) and is set on every
// tool span so a trace answers "why was this allowed/denied".
export const AGENT = {
  runId: "agent.run.id",
  ticketId: "agent.ticket.id",
  category: "agent.ticket.category",
  toolServer: "agent.tool.server",
  toolName: "agent.tool.name",
  policyDecision: "agent.policy.decision",
  policyReasons: "agent.policy.decision.reasons",
  policyAsi: "agent.policy.decision.asi",
  scopeState: "agent.scope.state",
  approvalState: "agent.approval.state",
  killState: "agent.kill.state",
  circuitState: "agent.circuit.state",
  refused: "agent.run.refused",
  costUsd: "agent.run.cost_usd",
} as const;
