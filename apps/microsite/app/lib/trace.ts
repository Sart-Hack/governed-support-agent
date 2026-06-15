// Pre-captured trace trees for the deployed demo, which never calls a live LLM.
// Shapes mirror the agent's real span/audit kinds; the costs use gpt-4o-mini list
// pricing and the breaker uses the real $0.50 ceiling. Pure data + derivations,
// so the page and the playback component ship no WASM and no network.

export type SpanKind = "run" | "step" | "llm" | "tool" | "policy" | "breaker";
export type SpanDecision = "allow" | "needs-approval" | "deny";

export type Span = {
  id: string;
  parentId: string | null;
  name: string;
  source: string;
  kind: SpanKind;
  startMs: number;
  durMs: number;
  detail?: string;
  tokens?: number;
  costUsd?: number;
  decision?: SpanDecision;
  policyId?: string;
  asi?: string;
  ok?: boolean;
  halted?: boolean;
};

export type Trace = {
  id: string;
  ticket: string;
  title: string;
  summary: string;
  baseClock: string; // wall-clock of startMs = 0, e.g. "14:02:31"
  costCeilingUsd: number;
  spans: Span[]; // authored in execution order; startMs non-decreasing
};

// gpt-4o-mini list pricing, the same constants the agent feeds the breaker.
const PROMPT = 0.15 / 1_000_000;
const COMPLETION = 0.6 / 1_000_000;
const llmCost = (promptTokens: number, completionTokens: number) =>
  promptTokens * PROMPT + completionTokens * COMPLETION;

// Scenario 1 (TCK-1): a how-to ticket resolved internally. Two model calls, three
// allowed tool calls, no customer-facing action, so no approval gate. The whole
// governed run costs a fraction of a cent against a $0.50 ceiling.
const SCENARIO_1: Trace = {
  id: "scenario-1",
  ticket: "TCK-1",
  title: "Internal resolution",
  summary: "A how-to ticket classified, researched in the KB, and answered with an internal note.",
  baseClock: "14:02:31",
  costCeilingUsd: 0.5,
  spans: [
    {
      id: "run",
      parentId: null,
      name: "support-ops",
      source: "workflow",
      kind: "run",
      startMs: 0,
      durMs: 4000,
      detail: "ticket TCK-1",
    },

    {
      id: "ingest",
      parentId: "run",
      name: "ingest",
      source: "ingest",
      kind: "step",
      startMs: 0,
      durMs: 1550,
    },
    {
      id: "ingest.scope",
      parentId: "ingest",
      name: "scope.granted",
      source: "zendesk",
      kind: "policy",
      startMs: 40,
      durMs: 30,
      decision: "allow",
      policyId: "01-zendesk-read-only",
      asi: "ASI02 Tool Misuse",
      detail: "getTicket scope granted",
    },
    {
      id: "ingest.get",
      parentId: "ingest",
      name: "getTicket",
      source: "zendesk",
      kind: "tool",
      startMs: 80,
      durMs: 260,
      ok: true,
      detail: "getTicket(TCK-1)",
    },
    {
      id: "ingest.llm",
      parentId: "ingest",
      name: "classify",
      source: "ingest",
      kind: "llm",
      startMs: 360,
      durMs: 1150,
      tokens: 412,
      costUsd: llmCost(352, 60),
      detail: "gpt-4o-mini · 412 tokens",
    },

    {
      id: "triage",
      parentId: "run",
      name: "triage",
      source: "triage",
      kind: "step",
      startMs: 1550,
      durMs: 1500,
    },
    {
      id: "triage.policy",
      parentId: "triage",
      name: "policy.decision",
      source: "policy",
      kind: "policy",
      startMs: 1600,
      durMs: 60,
      decision: "allow",
      policyId: "02-notion-tag-filtered",
      asi: "ASI01 Agent Goal Hijack",
      detail: "search → allow (tag=support-kb)",
    },
    {
      id: "triage.search",
      parentId: "triage",
      name: "search",
      source: "notion",
      kind: "tool",
      startMs: 1700,
      durMs: 300,
      ok: true,
      detail: "search(support-kb)",
    },
    {
      id: "triage.llm",
      parentId: "triage",
      name: "plan",
      source: "triage",
      kind: "llm",
      startMs: 2050,
      durMs: 950,
      tokens: 781,
      costUsd: llmCost(693, 88),
      detail: "gpt-4o-mini · 781 tokens",
    },

    {
      id: "policy-check",
      parentId: "run",
      name: "policy-check",
      source: "policy-check",
      kind: "step",
      startMs: 3050,
      durMs: 250,
    },
    {
      id: "policy-check.reply",
      parentId: "policy-check",
      name: "policy.decision",
      source: "policy",
      kind: "policy",
      startMs: 3090,
      durMs: 70,
      decision: "allow",
      policyId: "01-zendesk-read-only",
      asi: "ASI02 Tool Misuse",
      detail: "replyInternal → allow",
    },

    {
      id: "approval",
      parentId: "run",
      name: "approval-gate",
      source: "approval-gate",
      kind: "step",
      startMs: 3300,
      durMs: 120,
      detail: "not required (no customer-facing action)",
    },

    {
      id: "execute",
      parentId: "run",
      name: "execute",
      source: "execute",
      kind: "step",
      startMs: 3420,
      durMs: 480,
    },
    {
      id: "execute.reply",
      parentId: "execute",
      name: "replyInternal",
      source: "zendesk",
      kind: "tool",
      startMs: 3460,
      durMs: 360,
      ok: true,
      detail: "replyInternal(TCK-1) ok",
    },

    {
      id: "audit",
      parentId: "run",
      name: "run.summary",
      source: "audit",
      kind: "step",
      startMs: 3900,
      durMs: 100,
      ok: true,
      detail: "1 action executed · 0 refused",
    },
  ],
};

// Scenario 2 (TCK-2): a runaway sub-goal loop. Each iteration books a $0.06 model
// call; the circuit breaker halts the run the instant cumulative cost crosses the
// $0.50 ceiling. The breaker trips after the 9th call (cumulative $0.54); the 10th
// is never started. This is the run where the ceiling line earns its place.
const STEP_COST = 0.06;
const SCENARIO_2: Trace = {
  id: "scenario-2",
  ticket: "TCK-2",
  title: "Runaway loop, halted",
  summary:
    "A sub-goal loop bills a model call each iteration; the circuit breaker halts it at the $0.50 ceiling before it can run away.",
  baseClock: "02:14:08",
  costCeilingUsd: 0.5,
  spans: [
    {
      id: "run",
      parentId: null,
      name: "support-ops",
      source: "workflow",
      kind: "run",
      startMs: 0,
      durMs: 4100,
      detail: "ticket TCK-2 · runaway sub-goal",
    },
    {
      id: "plan",
      parentId: "run",
      name: "plan",
      source: "triage",
      kind: "step",
      startMs: 0,
      durMs: 4100,
      detail: "expands a sub-goal it cannot satisfy",
    },
    ...Array.from({ length: 9 }, (_, i): Span => {
      const n = i + 1;
      return {
        id: `subgoal-${n}`,
        parentId: "plan",
        name: `subgoal-${n}`,
        source: "planner",
        kind: "llm",
        startMs: 120 + i * 400,
        durMs: 360,
        tokens: 1000,
        costUsd: STEP_COST,
        detail: `gpt-4o-mini · cumulative $${(n * STEP_COST).toFixed(2)}`,
      };
    }),
    {
      id: "breaker",
      parentId: "run",
      name: "circuit.tripped",
      source: "breaker",
      kind: "breaker",
      startMs: 3760,
      durMs: 120,
      halted: true,
      detail: "cost ceiling $0.50 reached (cumulative $0.54); 10th call never started",
    },
  ],
};

const TRACES: Record<string, Trace> = {
  "scenario-1": SCENARIO_1,
  "scenario-2": SCENARIO_2,
};

export function traceIds(): string[] {
  return Object.keys(TRACES);
}

export function traceById(id: string): Trace | undefined {
  return TRACES[id];
}

export function traceSummaries(): { id: string; ticket: string; title: string }[] {
  return Object.values(TRACES).map((t) => ({ id: t.id, ticket: t.ticket, title: t.title }));
}

/** Tree depth of a span (root = 0), by walking parentId. */
export function spanDepth(trace: Trace, span: Span): number {
  const byId = new Map(trace.spans.map((s) => [s.id, s]));
  let depth = 0;
  let cur = span.parentId;
  while (cur) {
    depth += 1;
    cur = byId.get(cur)?.parentId ?? null;
  }
  return depth;
}

/** Spans that participate in playback (everything but the root run), in order. */
export function playbackSpans(trace: Trace): Span[] {
  return trace.spans.filter((s) => s.kind !== "run");
}

export function totalDurMs(trace: Trace): number {
  return Math.max(...trace.spans.map((s) => s.startMs + s.durMs));
}

export function totalCostUsd(trace: Trace): number {
  return trace.spans.reduce((sum, s) => sum + (s.costUsd ?? 0), 0);
}

/** Stepwise cumulative-cost points for the overlay, in time order. */
export function costPoints(trace: Trace): { ms: number; cumUsd: number }[] {
  const billed = trace.spans
    .filter((s) => (s.costUsd ?? 0) > 0)
    .sort((a, b) => a.startMs - b.startMs);
  let cum = 0;
  return billed.map((s) => {
    cum += s.costUsd ?? 0;
    return { ms: s.startMs + s.durMs, cumUsd: cum };
  });
}

/** Format a span's wall-clock from the trace base clock + startMs. */
export function clockAt(trace: Trace, ms: number): string {
  const [h, m, s] = trace.baseClock.split(":").map(Number);
  const base = (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0);
  const t = base + Math.floor(ms / 1000);
  const hh = Math.floor(t / 3600) % 24;
  const mm = Math.floor(t / 60) % 60;
  const ss = t % 60;
  return [hh, mm, ss].map((n) => String(n).padStart(2, "0")).join(":");
}
