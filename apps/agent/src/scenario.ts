import { randomUUID } from "node:crypto";
import { TracingAuditSink, initTracing } from "@gsa/tracing";
import { InMemoryAuditSink } from "@sarthak/agent-shield";
import { buildGovernance } from "./governance.js";
import { BifrostChatModel } from "./llm/bifrost.js";
import { defaultApprovalChannel } from "./slack/approval.js";
import type { RunState } from "./steps.js";
import { buildSupportOpsWorkflow } from "./workflow.js";

// Scenario runner with a human-in-the-loop suspend point.
//   tsx scenario.ts <ticketId>                       -> run; suspends at approval if needed
//   tsx scenario.ts resume <runId> <approve|reject> [comment]
// The two-invocation form proves the run survives a process exit (Postgres
// checkpoint), standing in for "approve in Slack later".

async function build(runId: string) {
  const tracing = initTracing();
  const memory = new InMemoryAuditSink();
  const audit = new TracingAuditSink(tracing.tracer, memory);
  const gov = await buildGovernance({ runId, audit });
  const deps = {
    shield: gov.shield,
    gateway: gov.pool,
    llm: new BifrostChatModel(),
    approvalChannel: defaultApprovalChannel(),
  };
  const mastra = buildSupportOpsWorkflow(deps);
  return { tracing, memory, gov, mastra };
}

async function start(ticketId: string): Promise<void> {
  const runId = randomUUID();
  console.log(`\n▸ scenario run: ticket=${ticketId} runId=${runId}\n`);
  const { tracing, gov, mastra } = await build(runId);
  try {
    const run = await mastra.getWorkflow("supportOps").createRun({ runId });
    const result = await run.start({ inputData: { runId, ticketId } });
    if (result.status === "suspended") {
      console.log(`\n⏸  suspended at approval gate. runId=${runId}`);
      console.log("   The run is checkpointed in Postgres and survives a restart.");
    } else if (result.status === "success") {
      printOutcome(result.result as RunState);
    } else {
      console.log(`status=${result.status}`);
      process.exitCode = 1;
    }
  } finally {
    auditFinish(gov, runId);
    await gov.close();
    await tracing.shutdown();
  }
}

async function resume(
  runId: string,
  decision: "approved" | "rejected",
  comment?: string,
): Promise<void> {
  console.log(`\n▸ resume runId=${runId} decision=${decision}\n`);
  const { tracing, gov, mastra } = await build(runId);
  try {
    const run = await mastra.getWorkflow("supportOps").createRun({ runId });
    const result = await run.resume({
      step: "approval-gate",
      resumeData: { decision, approver: "lead@demo", comment },
    });
    if (result.status === "success") {
      printOutcome(result.result as RunState);
    } else {
      console.log(`status=${result.status}`);
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = 1;
    }
  } finally {
    auditFinish(gov, runId);
    await gov.close();
    await tracing.shutdown();
  }
}

function auditFinish(gov: { audit: unknown }, runId: string): void {
  const sink = gov.audit as { finishRun?: (id: string) => void };
  sink.finishRun?.(runId);
}

function printOutcome(state: RunState): void {
  console.log("── outcome ─────────────────────────────────");
  console.log(`  approval  : ${state.approval?.state}`);
  console.log(`  revised   : ${state.execution?.revised ?? false}`);
  console.log(
    `  executed  : ${state.execution?.results.map((r) => `${r.tool}(${r.ok ? "ok" : "err"})`).join(", ") || "(none)"}`,
  );
  console.log("");
}

const [, , a, b, c, ...rest] = process.argv;
const decision = c?.toLowerCase().startsWith("app") ? "approved" : "rejected";
const main =
  a === "resume" ? resume(b ?? "", decision, rest.join(" ") || undefined) : start(a ?? "TCK-3");

main.then(
  () => process.exit(process.exitCode ?? 0),
  (err) => {
    console.error("\n✗ scenario error:", err);
    process.exit(1);
  },
);
