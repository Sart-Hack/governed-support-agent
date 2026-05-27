/**
 * Phase 2 / Spike 1 — Mastra v2 `.suspend()` / `.resume()` durability test.
 *
 * Goal: prove that a Mastra v2 workflow run can suspend, persist to Postgres,
 * survive a Postgres restart, then resume from a fresh process and complete.
 *
 * Usage:
 *   pnpm --filter @gsa/agent spike:mastra:start
 *     → starts a new run, suspends at the approval step, prints the runId
 *   docker compose restart postgres
 *   pnpm --filter @gsa/agent spike:mastra:resume <runId>
 *     → rehydrates the run, supplies the resume payload, prints the final output
 */

import { Mastra } from "@mastra/core";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { PostgresStore } from "@mastra/pg";
import { z } from "zod";

const connectionString =
  process.env.MASTRA_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/mastra";

const announce = createStep({
  id: "announce",
  inputSchema: z.object({ ticketId: z.string() }),
  outputSchema: z.object({ ticketId: z.string(), announcedAt: z.string() }),
  execute: async ({ inputData }) => {
    const announcedAt = new Date().toISOString();
    console.log(`[announce] ticket=${inputData.ticketId} at=${announcedAt}`);
    return { ticketId: inputData.ticketId, announcedAt };
  },
});

const awaitApproval = createStep({
  id: "awaitApproval",
  inputSchema: z.object({ ticketId: z.string(), announcedAt: z.string() }),
  suspendSchema: z.object({ awaitingApprovalFor: z.string() }),
  resumeSchema: z.object({
    approved: z.boolean(),
    approver: z.string(),
  }),
  outputSchema: z.object({
    ticketId: z.string(),
    approved: z.boolean(),
    approver: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      console.log(`[awaitApproval] suspending for ticket=${inputData.ticketId}`);
      return await suspend({ awaitingApprovalFor: inputData.ticketId });
    }
    console.log(
      `[awaitApproval] resumed: approved=${resumeData.approved} approver=${resumeData.approver}`,
    );
    return {
      ticketId: inputData.ticketId,
      approved: resumeData.approved,
      approver: resumeData.approver,
    };
  },
});

const finalize = createStep({
  id: "finalize",
  inputSchema: z.object({
    ticketId: z.string(),
    approved: z.boolean(),
    approver: z.string(),
  }),
  outputSchema: z.object({
    ticketId: z.string(),
    finalState: z.enum(["accepted", "rejected"]),
    approver: z.string(),
  }),
  execute: async ({ inputData }) => {
    const finalState = inputData.approved ? ("accepted" as const) : ("rejected" as const);
    console.log(
      `[finalize] ticket=${inputData.ticketId} state=${finalState} approver=${inputData.approver}`,
    );
    return {
      ticketId: inputData.ticketId,
      finalState,
      approver: inputData.approver,
    };
  },
});

const approvalWorkflow = createWorkflow({
  id: "spike-suspend-resume",
  inputSchema: z.object({ ticketId: z.string() }),
  outputSchema: z.object({
    ticketId: z.string(),
    finalState: z.enum(["accepted", "rejected"]),
    approver: z.string(),
  }),
})
  .then(announce)
  .then(awaitApproval)
  .then(finalize)
  .commit();

function buildMastra() {
  return new Mastra({
    workflows: { approvalWorkflow },
    storage: new PostgresStore({ id: "gsa-mastra-store", connectionString }),
  });
}

async function runStart() {
  const mastra = buildMastra();
  const workflow = mastra.getWorkflow("approvalWorkflow");
  const run = await workflow.createRun();
  console.log(`[spike] starting run runId=${run.runId}`);
  const result = await run.start({ inputData: { ticketId: "TCK-42" } });
  console.log(`[spike] start returned status=${result.status} runId=${run.runId}`);
  if (result.status === "suspended") {
    console.log(`[spike] suspended at step(s)=${JSON.stringify(result.suspended)}`);
    console.log(
      `\nNext: docker compose restart postgres && pnpm --filter @gsa/agent spike:mastra:resume ${run.runId}`,
    );
  } else {
    console.log(`[spike] unexpected non-suspended result: ${JSON.stringify(result, null, 2)}`);
    process.exitCode = 1;
  }
}

async function runResume(runId: string) {
  const mastra = buildMastra();
  const workflow = mastra.getWorkflow("approvalWorkflow");
  const run = await workflow.createRun({ runId });
  console.log(`[spike] resuming runId=${runId}`);
  const result = await run.resume({
    step: "awaitApproval",
    resumeData: { approved: true, approver: "sarthak@demo" },
  });
  console.log(`[spike] resume returned status=${result.status} runId=${run.runId}`);
  if (result.status === "success") {
    console.log(`[spike] final output: ${JSON.stringify(result.result, null, 2)}`);
  } else {
    console.log(`[spike] unexpected result: ${JSON.stringify(result, null, 2)}`);
    process.exitCode = 1;
  }
}

const [, , cmd, arg] = process.argv;
const main = async () => {
  if (cmd === "start") return runStart();
  if (cmd === "resume") {
    if (!arg) {
      console.error("usage: spike-suspend-resume.ts resume <runId>");
      process.exitCode = 1;
      return;
    }
    return runResume(arg);
  }
  console.error("usage: spike-suspend-resume.ts <start|resume <runId>>");
  process.exitCode = 1;
};

main().then(
  () => process.exit(process.exitCode ?? 0),
  (err) => {
    console.error("[spike] error:", err);
    process.exit(1);
  },
);
