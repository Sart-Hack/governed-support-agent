import { randomUUID } from "node:crypto";
import { TracingAuditSink, initTracing } from "@gsa/tracing";
import { InMemoryAuditSink } from "@sarthak/agent-shield";
import { buildGovernance } from "./governance.js";
import { BifrostChatModel } from "./llm/bifrost.js";
import type { RunState } from "./steps.js";
import { buildSupportOpsWorkflow } from "./workflow.js";

// `pnpm demo [ticketId]` — runs scenario 1 (TCK-1) end-to-end through the Mastra
// workflow: Bifrost LLM, governed MCP tool calls, Cedar policy checks, and an
// OTel trace tree exported to Langfuse.

async function main(): Promise<void> {
  const ticketId = process.argv[2] ?? "TCK-1";
  const runId = randomUUID();

  console.log("\n▸ Governed Support Ops Agent: scenario run");
  console.log(`  ticket=${ticketId} runId=${runId}\n`);

  const tracing = initTracing();
  const memory = new InMemoryAuditSink();
  const audit = new TracingAuditSink(tracing.tracer, memory);

  const gov = await buildGovernance({ runId, audit });
  const llm = new BifrostChatModel();
  console.log(`  LLM endpoint : Bifrost → ${llm.id}`);
  console.log(`  tracing      : ${tracing.enabled ? "Langfuse (OTLP)" : "disabled (no keys)"}`);

  const mastra = buildSupportOpsWorkflow({ shield: gov.shield, gateway: gov.pool, llm });
  const workflow = mastra.getWorkflow("supportOps");

  try {
    const run = await workflow.createRun({ runId });
    const result = await run.start({ inputData: { runId, ticketId } });

    if (result.status === "suspended") {
      console.log("\n⏸  suspended at the approval gate (customer-facing action).");
      console.log(
        `   resume: pnpm --filter @gsa/agent scenario:resume ${runId} <approve|reject> "comment"`,
      );
      printAuditTrail(memory.list());
      return;
    }
    if (result.status !== "success") {
      console.log(`\n✗ workflow status=${result.status}`);
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = 1;
      return;
    }

    printOutcome(result.result as RunState);
    printAuditTrail(memory.list());
  } finally {
    audit.finishRun(runId);
    await gov.close();
    await tracing.shutdown(); // flushes spans to Langfuse
  }

  if (tracing.enabled) await verifyTrace();
}

/** Poll Langfuse for the just-exported trace and print a one-line confirmation + link. */
async function verifyTrace(): Promise<void> {
  const base = process.env.LANGFUSE_BASE_URL ?? "http://localhost:3001";
  const pk = process.env.LANGFUSE_PUBLIC_KEY ?? process.env.LANGFUSE_INIT_PROJECT_PUBLIC_KEY;
  const sk = process.env.LANGFUSE_SECRET_KEY ?? process.env.LANGFUSE_INIT_PROJECT_SECRET_KEY;
  const projectId = process.env.LANGFUSE_INIT_PROJECT_ID ?? "governed-support-agent";
  if (!pk || !sk) return;

  const auth = Buffer.from(`${pk}:${sk}`).toString("base64");
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const res = await fetch(`${base}/api/public/traces?limit=5&name=support-ops`, {
        headers: { authorization: `Basic ${auth}` },
      });
      const body = (await res.json()) as {
        data?: { id: string; name: string; observations?: unknown[] }[];
      };
      const trace = body.data?.find((t) => t.name === "support-ops");
      if (trace) {
        console.log("── langfuse ─────────────────────────────────");
        console.log(`  trace landed : ${trace.observations?.length ?? 0} observations`);
        console.log(`  view         : ${base}/project/${projectId}/traces/${trace.id}`);
        console.log("");
        return;
      }
    } catch {
      // keep polling
    }
  }
  console.log("── langfuse ─────────────────────────────────");
  console.log("  trace not visible yet (ingestion lag); check the Langfuse UI.\n");
}

function printOutcome(state: RunState): void {
  console.log("\n── outcome ─────────────────────────────────");
  console.log(
    `  classification : ${state.classification?.category} (customerFacing=${state.classification?.customerFacing})`,
  );
  console.log(`  plan           : ${state.plan?.summary}`);
  for (const r of state.redactions ?? []) {
    console.log(
      `  redaction[${r.surface}] : ${r.transform} → ${r.items.join(", ")} [${r.asiIds.join(", ")}]`,
    );
  }
  for (const j of state.policy?.judgements ?? []) {
    console.log(`  policy[${j.tool}] : ${j.disposition}: ${j.reason}`);
  }
  console.log(`  approval       : ${state.approval?.state}`);
  console.log(
    `  executed       : ${state.execution?.results.map((r) => `${r.tool}(${r.ok ? "ok" : "err"})`).join(", ") || "(none)"}`,
  );
}

function printAuditTrail(
  events: readonly { kind: string; stepId?: string; payload: Record<string, unknown> }[],
): void {
  console.log(`\n── audit trail (${events.length} events) ──`);
  for (const e of events) {
    if (e.kind === "policy.transform") {
      const items = (e.payload.redactions as string[] | undefined)?.join(", ") ?? "";
      const asi = (e.payload.asiIds as string[] | undefined)?.join(", ") ?? "";
      console.log(
        `  ${e.stepId ?? "-"} · policy.transform · ${e.payload.server}.${e.payload.tool} → redacted ${items} [${asi}]`,
      );
      continue;
    }
    const tool = e.payload.tool ?? e.payload.server ?? e.payload.model ?? "";
    console.log(`  ${e.stepId ?? "-"} · ${e.kind}${tool ? ` · ${tool}` : ""}`);
  }
  console.log("");
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (err) => {
    console.error("\n✗ demo error:", err);
    process.exit(1);
  },
);
