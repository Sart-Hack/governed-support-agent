import { Mastra } from "@mastra/core";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { PostgresStore } from "@mastra/pg";
import { z } from "zod";
import {
  type AgentDeps,
  type RunState,
  approvalGateStep,
  auditStep,
  classifyStep,
  executeStep,
  policyCheckStep,
  triageStep,
} from "./steps.js";

const classificationSchema = z.object({
  category: z.string(),
  customerFacing: z.boolean(),
  summary: z.string(),
});

const plannedActionSchema = z.object({
  server: z.string(),
  tool: z.string(),
  args: z.record(z.unknown()),
  customerFacing: z.boolean(),
});

const stateSchema = z.object({
  runId: z.string(),
  ticketId: z.string(),
  classification: classificationSchema.optional(),
  plan: z.object({ actions: z.array(plannedActionSchema), summary: z.string() }).optional(),
  policy: z
    .object({
      judgements: z.array(
        z.object({
          tool: z.string(),
          disposition: z.enum(["allow", "needs-approval", "refuse"]),
          reason: z.string(),
          asiIds: z.array(z.string()),
        }),
      ),
      refused: z.boolean(),
    })
    .optional(),
  approval: z
    .object({ state: z.enum(["not-required", "required", "approved", "rejected"]) })
    .optional(),
  execution: z
    .object({ results: z.array(z.object({ tool: z.string(), ok: z.boolean() })) })
    .optional(),
});

const inputSchema = z.object({ runId: z.string(), ticketId: z.string() });

type PhaseFn = (state: RunState, ctx: { runId: string; stepId: string }) => Promise<RunState>;

function mastraStep(deps: AgentDeps, id: string, phase: PhaseFn, first = false) {
  const wrapped = deps.shield.wrap(phase);
  return createStep({
    id,
    inputSchema: first ? inputSchema : stateSchema,
    outputSchema: stateSchema,
    execute: async ({ inputData }) => {
      const state = inputData as RunState;
      return wrapped(state, { runId: state.runId, stepId: id });
    },
  });
}

export interface BuildWorkflowOptions {
  /** Postgres connection for the durable checkpoint store (HITL suspend/resume). */
  connectionString?: string;
}

/**
 * The support-ops workflow as a Mastra v2 workflow: six steps, each wrapped by
 * agent-shield (kill-switch + circuit-breaker + audit around every step). State
 * is checkpointed to Postgres so the approval gate can suspend/resume (M8).
 */
export function buildSupportOpsWorkflow(deps: AgentDeps, opts: BuildWorkflowOptions = {}): Mastra {
  const connectionString =
    opts.connectionString ??
    process.env.MASTRA_DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/mastra";

  const workflow = createWorkflow({ id: "support-ops", inputSchema, outputSchema: stateSchema })
    .then(mastraStep(deps, "ingest", classifyStep(deps), true))
    .then(mastraStep(deps, "triage", triageStep(deps)))
    .then(mastraStep(deps, "policy-check", policyCheckStep(deps)))
    .then(mastraStep(deps, "approval-gate", approvalGateStep(deps)))
    .then(mastraStep(deps, "execute", executeStep(deps)))
    .then(mastraStep(deps, "audit", auditStep(deps)))
    .commit();

  return new Mastra({
    workflows: { supportOps: workflow },
    storage: new PostgresStore({ id: "gsa-support-ops", connectionString }),
  });
}
