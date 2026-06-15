import { Mastra } from "@mastra/core";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { PostgresStore } from "@mastra/pg";
import { z } from "zod";
import { ConsoleApprovalChannel } from "./slack/approval.js";
import {
  type AgentDeps,
  type RunState,
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
  accountId: z.string().optional(),
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
    .object({
      results: z.array(z.object({ tool: z.string(), ok: z.boolean() })),
      revised: z.boolean().optional(),
    })
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

const resumeSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  approver: z.string(),
  comment: z.string().optional(),
});

/**
 * The approval gate: a Mastra suspend point. If the plan has a customer-facing
 * action (policy 05 needs-approval), it posts an approval request and suspends —
 * the run state checkpoints to Postgres and survives a restart. On resume, the
 * human decision (approved/rejected) flows into the state for the execute step.
 */
function approvalGateMastraStep(deps: AgentDeps) {
  const channel = deps.approvalChannel ?? new ConsoleApprovalChannel();
  return createStep({
    id: "approval-gate",
    inputSchema: stateSchema,
    outputSchema: stateSchema,
    resumeSchema,
    suspendSchema: z.object({ runId: z.string(), ticketId: z.string(), pendingTool: z.string() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      const state = inputData as RunState;
      // A hard refusal rejects the whole plan; there is nothing to approve, so do
      // not suspend. The deny stands and the execute step short-circuits on it.
      if (state.policy?.refused) {
        return { ...state, approval: { state: "not-required" as const } };
      }
      const pending =
        state.policy?.judgements.filter((j) => j.disposition === "needs-approval") ?? [];
      if (pending.length === 0) {
        return { ...state, approval: { state: "not-required" as const } };
      }

      if (!resumeData) {
        const action = state.plan?.actions.find((a) => a.customerFacing);
        await channel.request({
          runId: state.runId,
          ticketId: state.ticketId,
          toolSummary: `${pending[0]?.tool} on ${state.ticketId}`,
          draft: String(action?.args.text ?? ""),
          reason: pending[0]?.reason ?? "customer-facing action requires approval",
        });
        deps.shield.audit({
          ts: new Date().toISOString(),
          runId: state.runId,
          stepId: "approval-gate",
          kind: "approval.requested",
          payload: { tool: pending[0]?.tool },
        });
        return await suspend({
          runId: state.runId,
          ticketId: state.ticketId,
          pendingTool: pending[0]?.tool ?? "",
        });
      }

      deps.shield.audit({
        ts: new Date().toISOString(),
        runId: state.runId,
        stepId: "approval-gate",
        kind: "approval.resolved",
        payload: {
          state: resumeData.decision,
          approver: resumeData.approver,
          comment: resumeData.comment,
        },
      });
      return { ...state, approval: { state: resumeData.decision } };
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
    .then(approvalGateMastraStep(deps))
    .then(mastraStep(deps, "execute", executeStep(deps)))
    .then(mastraStep(deps, "audit", auditStep(deps)))
    .commit();

  return new Mastra({
    workflows: { supportOps: workflow },
    storage: new PostgresStore({ id: "gsa-support-ops", connectionString }),
  });
}
