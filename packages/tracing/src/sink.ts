import {
  type Context,
  type Span,
  SpanStatusCode,
  type Tracer,
  context as otelContext,
  trace,
} from "@opentelemetry/api";
import {
  type AuditEvent,
  type AuditSink,
  type PolicyDecision,
  formatDecision,
} from "@sarthak/agent-shield";
import { AGENT, GEN_AI } from "./attributes.js";

interface RunSpans {
  root: Span;
  rootCtx: Context;
  steps: Map<string, { span: Span; ctx: Context }>;
  currentStepId?: string;
  toolSpan?: Span;
  pendingDecision?: PolicyDecision;
}

/**
 * Translates the agent's ordered audit-event stream into an OpenTelemetry span
 * tree (run → step → tool / llm). Mechanism-agnostic: it works identically
 * whether the events come from the Mastra workflow or the in-process runner.
 * Wrap an inner sink (e.g. InMemoryAuditSink) to keep the events too.
 */
export class TracingAuditSink implements AuditSink {
  private readonly runs = new Map<string, RunSpans>();

  constructor(
    private readonly tracer: Tracer,
    private readonly inner?: AuditSink,
  ) {}

  append(event: AuditEvent): void {
    this.inner?.append(event);
    try {
      this.handle(event);
    } catch {
      // Tracing must never break a run.
    }
  }

  /** End the run's root span (and any lingering children). Call once the run resolves. */
  finishRun(runId: string): void {
    const r = this.runs.get(runId);
    if (!r) return;
    r.toolSpan?.end();
    for (const s of r.steps.values()) s.span.end();
    r.root.end();
    this.runs.delete(runId);
  }

  private ensureRun(runId: string): RunSpans {
    let r = this.runs.get(runId);
    if (!r) {
      const root = this.tracer.startSpan("support-ops");
      root.setAttribute(AGENT.runId, runId);
      r = { root, rootCtx: trace.setSpan(otelContext.active(), root), steps: new Map() };
      this.runs.set(runId, r);
    }
    return r;
  }

  private currentStep(r: RunSpans): { span: Span; ctx: Context } | undefined {
    return r.currentStepId ? r.steps.get(r.currentStepId) : undefined;
  }

  private handle(e: AuditEvent): void {
    const r = this.ensureRun(e.runId);
    const stepId = e.stepId;

    switch (e.kind) {
      case "step.start": {
        if (!stepId) break;
        const span = this.tracer.startSpan(stepId, undefined, r.rootCtx);
        r.steps.set(stepId, { span, ctx: trace.setSpan(r.rootCtx, span) });
        r.currentStepId = stepId;
        r.pendingDecision = undefined;
        break;
      }
      case "step.end":
      case "step.error": {
        if (!stepId) break;
        const s = r.steps.get(stepId);
        if (s) {
          if (e.kind === "step.error") {
            s.span.setStatus({
              code: SpanStatusCode.ERROR,
              message: String(e.payload.message ?? ""),
            });
          }
          s.span.end();
          r.steps.delete(stepId);
        }
        r.pendingDecision = undefined;
        break;
      }
      case "policy.decision": {
        if (e.decision) {
          r.pendingDecision = e.decision;
          const step = this.currentStep(r);
          if (step) {
            const attrs = decisionAttrs(e.decision, e.payload.tool);
            step.span.addEvent("policy.decision", attrs);
            // A deny is terminal for this action: it is refused before dispatch, so
            // no tool.call follows to carry the decision attributes onto a tool span.
            // Pin them on the step span here so a refused action's reason chain
            // (e.g. cross-tenant ASI06, delete ASI10) is queryable on the trace,
            // not just inferable from the run-level refused flag.
            if (e.decision.decision === "deny") {
              for (const [k, v] of Object.entries(attrs)) step.span.setAttribute(k, v);
            }
          }
        }
        break;
      }
      case "tool.call": {
        const parentCtx = this.currentStep(r)?.ctx ?? r.rootCtx;
        const server = String(e.payload.server ?? "");
        const tool = String(e.payload.tool ?? "");
        const span = this.tracer.startSpan(`${server}.${tool}`, undefined, parentCtx);
        span.setAttribute(AGENT.toolServer, server);
        span.setAttribute(AGENT.toolName, tool);
        if (r.pendingDecision) {
          for (const [k, v] of Object.entries(decisionAttrs(r.pendingDecision, tool))) {
            span.setAttribute(k, v);
          }
          r.pendingDecision = undefined;
        }
        r.toolSpan = span;
        break;
      }
      case "tool.result": {
        if (r.toolSpan) {
          if (e.payload.isError === true) r.toolSpan.setStatus({ code: SpanStatusCode.ERROR });
          r.toolSpan.end();
          r.toolSpan = undefined;
        }
        break;
      }
      case "scope.granted":
      case "scope.denied": {
        const target = r.toolSpan ?? this.currentStep(r)?.span;
        target?.addEvent(e.kind, {
          [AGENT.scopeState]: e.kind === "scope.granted" ? "granted" : "denied",
          [AGENT.toolName]: String(e.payload.tool ?? ""),
        });
        break;
      }
      case "llm.completion": {
        const parentCtx = this.currentStep(r)?.ctx ?? r.rootCtx;
        const model = String(e.payload.model ?? "unknown");
        const span = this.tracer.startSpan(`llm ${model}`, undefined, parentCtx);
        span.setAttribute(GEN_AI.system, String(e.payload.system ?? "openai"));
        span.setAttribute(GEN_AI.operationName, "chat");
        span.setAttribute(GEN_AI.requestModel, model);
        span.setAttribute(GEN_AI.responseModel, String(e.payload.responseModel ?? model));
        if (typeof e.payload.inputTokens === "number") {
          span.setAttribute(GEN_AI.usageInputTokens, e.payload.inputTokens);
        }
        if (typeof e.payload.outputTokens === "number") {
          span.setAttribute(GEN_AI.usageOutputTokens, e.payload.outputTokens);
        }
        span.end();
        break;
      }
      case "run.summary": {
        r.root.setAttribute(AGENT.ticketId, String(e.payload.ticketId ?? ""));
        if (e.payload.category) r.root.setAttribute(AGENT.category, String(e.payload.category));
        r.root.setAttribute(AGENT.refused, e.payload.refused === true);
        break;
      }
      case "kill.triggered":
        this.currentStep(r)?.span.setAttribute(AGENT.killState, "tripped");
        break;
      case "circuit.tripped":
        this.currentStep(r)?.span.setAttribute(AGENT.circuitState, "tripped");
        break;
      case "approval.requested":
        r.root.setAttribute(AGENT.approvalState, "requested");
        break;
      case "approval.resolved":
        r.root.setAttribute(AGENT.approvalState, String(e.payload.state ?? "resolved"));
        break;
    }
  }
}

function decisionAttrs(decision: PolicyDecision, tool: unknown): Record<string, string | string[]> {
  const f = formatDecision(decision);
  return {
    [AGENT.toolName]: String(tool ?? ""),
    [AGENT.policyDecision]: decision.decision,
    [AGENT.policyReasons]: f.reasonLines,
    [AGENT.policyAsi]: f.asiIds,
  };
}
