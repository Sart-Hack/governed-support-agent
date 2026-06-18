import {
  BasicTracerProvider,
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import type { AuditEvent, PolicyDecision } from "@sarthak/agent-shield";
import { describe, expect, it } from "vitest";
import { AGENT, GEN_AI } from "./attributes.js";
import { TracingAuditSink } from "./sink.js";

function allowDecision(): PolicyDecision {
  return {
    decision: "allow",
    reasons: [
      {
        policyId: "01-zendesk-read-only",
        effect: "permit",
        annotations: { asi: "ASI02 Tool Misuse", description: "SupportLead may triage." },
      },
    ],
    errors: [],
    request: {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "getTicket" },
      resource: { type: "Ticket", id: "TCK-1" },
    },
  };
}

function denyDecision(): PolicyDecision {
  return {
    decision: "deny",
    reasons: [
      {
        policyId: "07-tenant-isolation",
        effect: "forbid",
        annotations: {
          asi: "ASI06 Inter-Agent / Cross-Boundary",
          description: "Cross-tenant access is denied.",
        },
      },
    ],
    errors: [],
    request: {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "getAccount" },
      resource: { type: "Account", id: "ACC-8" },
    },
  };
}

function makeTracer() {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  return { tracer: provider.getTracer("test"), exporter };
}

const RUN = "run-1";
function ev(
  kind: AuditEvent["kind"],
  stepId: string,
  payload: Record<string, unknown> = {},
  decision?: PolicyDecision,
): AuditEvent {
  return { ts: "2026-06-04T00:00:00Z", runId: RUN, stepId, kind, payload, decision };
}

const HAPPY_PATH: AuditEvent[] = [
  ev("step.start", "ingest"),
  ev(
    "policy.decision",
    "ingest",
    { server: "zendesk", tool: "getTicket", decision: "allow" },
    allowDecision(),
  ),
  ev("scope.granted", "ingest", { tool: "getTicket" }),
  ev("tool.call", "ingest", { server: "zendesk", tool: "getTicket" }),
  ev("tool.result", "ingest", { tool: "getTicket", isError: false }),
  ev("llm.completion", "ingest", {
    model: "openai/gpt-4o-mini",
    inputTokens: 120,
    outputTokens: 18,
  }),
  ev("step.end", "ingest"),
  ev("run.summary", "audit", { ticketId: "TCK-1", category: "billing", refused: false }),
];

describe("TracingAuditSink", () => {
  it("builds a run → step → {tool, llm} span tree from the audit stream", () => {
    const { tracer, exporter } = makeTracer();
    const sink = new TracingAuditSink(tracer);
    for (const e of HAPPY_PATH) sink.append(e);
    sink.finishRun(RUN);

    const spans = exporter.getFinishedSpans();
    const byName = (n: string): ReadableSpan | undefined => spans.find((s) => s.name === n);

    expect(byName("support-ops")).toBeDefined();
    expect(byName("support-ops")?.attributes[AGENT.runId]).toBe(RUN);
    expect(byName("support-ops")?.attributes[AGENT.ticketId]).toBe("TCK-1");
    expect(byName("ingest")).toBeDefined();
  });

  it("puts the Cedar reason chain on the tool span", () => {
    const { tracer, exporter } = makeTracer();
    const sink = new TracingAuditSink(tracer);
    for (const e of HAPPY_PATH) sink.append(e);
    sink.finishRun(RUN);

    const tool = exporter.getFinishedSpans().find((s) => s.name === "zendesk.getTicket");
    expect(tool).toBeDefined();
    expect(tool?.attributes[AGENT.policyDecision]).toBe("allow");
    expect(tool?.attributes[AGENT.policyReasons]).toBeDefined();
    expect((tool?.attributes[AGENT.policyAsi] as string[]).some((a) => a.includes("ASI02"))).toBe(
      true,
    );
  });

  it("emits a gen_ai LLM span with pinned usage attributes", () => {
    const { tracer, exporter } = makeTracer();
    const sink = new TracingAuditSink(tracer);
    for (const e of HAPPY_PATH) sink.append(e);
    sink.finishRun(RUN);

    const llm = exporter.getFinishedSpans().find((s) => s.name.startsWith("llm "));
    expect(llm).toBeDefined();
    expect(llm?.attributes[GEN_AI.requestModel]).toBe("openai/gpt-4o-mini");
    expect(llm?.attributes[GEN_AI.usageInputTokens]).toBe(120);
    expect(llm?.attributes[GEN_AI.usageOutputTokens]).toBe(18);
  });

  it("pins a refused action's deny reason chain on the step span (no tool.call follows)", () => {
    const { tracer, exporter } = makeTracer();
    const sink = new TracingAuditSink(tracer);
    // A cross-tenant getAccount denied at policy-check: the decision is audited,
    // but the action is never dispatched, so there is no tool span to carry it.
    const events: AuditEvent[] = [
      ev("step.start", "policy-check"),
      ev(
        "policy.decision",
        "policy-check",
        { tool: "getAccount", decision: "deny" },
        denyDecision(),
      ),
      ev("step.end", "policy-check"),
      ev("run.summary", "audit", { ticketId: "TCK-8", refused: true }),
    ];
    for (const e of events) sink.append(e);
    sink.finishRun(RUN);

    const spans = exporter.getFinishedSpans();
    const step = spans.find((s) => s.name === "policy-check");
    expect(step?.attributes[AGENT.policyDecision]).toBe("deny");
    expect((step?.attributes[AGENT.policyAsi] as string[]).some((a) => a.includes("ASI06"))).toBe(
      true,
    );
    expect(
      (step?.attributes[AGENT.policyReasons] as string[]).some((r) =>
        r.includes("07-tenant-isolation"),
      ),
    ).toBe(true);
    // The run-level refused flag still lands on the root.
    expect(spans.find((s) => s.name === "support-ops")?.attributes[AGENT.refused]).toBe(true);
  });

  it("never throws on a malformed event", () => {
    const { tracer } = makeTracer();
    const sink = new TracingAuditSink(tracer);
    expect(() => sink.append(ev("tool.result", "x"))).not.toThrow();
  });
});
