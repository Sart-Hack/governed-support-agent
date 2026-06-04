import { randomUUID } from "node:crypto";
import { buildGovernance } from "./governance.js";
import { BifrostChatModel } from "./llm/bifrost.js";
import type { RunState } from "./steps.js";
import { buildSupportOpsWorkflow } from "./workflow.js";

// `pnpm demo [ticketId]` — runs scenario 1 (TCK-1) end-to-end through the Mastra
// workflow: Bifrost LLM, governed MCP tool calls, Cedar policy checks, audit log.

async function main(): Promise<void> {
  const ticketId = process.argv[2] ?? "TCK-1";
  const runId = randomUUID();

  console.log("\n▸ Governed Support Ops Agent: scenario run");
  console.log(`  ticket=${ticketId} runId=${runId}\n`);

  const gov = await buildGovernance({ runId });
  const llm = new BifrostChatModel();
  console.log(`  LLM endpoint: Bifrost → ${llm.id}`);

  const mastra = buildSupportOpsWorkflow({ shield: gov.shield, gateway: gov.pool, llm });
  const workflow = mastra.getWorkflow("supportOps");

  try {
    const run = await workflow.createRun({ runId });
    const result = await run.start({ inputData: { runId, ticketId } });

    if (result.status !== "success") {
      console.log(`\n✗ workflow status=${result.status}`);
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = 1;
      return;
    }

    const state = result.result as RunState;
    printOutcome(state);
    printAuditTrail(gov.audit.list());
  } finally {
    await gov.close();
  }
}

function printOutcome(state: RunState): void {
  console.log("\n── outcome ─────────────────────────────────");
  console.log(
    `  classification : ${state.classification?.category} (customerFacing=${state.classification?.customerFacing})`,
  );
  console.log(`  plan           : ${state.plan?.summary}`);
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
    const tool = e.payload.tool ?? e.payload.server ?? "";
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
