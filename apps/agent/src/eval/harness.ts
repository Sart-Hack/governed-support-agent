import type { CallResult } from "@gsa/mcp-client";
import { type PolicyDecision, type PolicyEvaluationRequest, evaluate } from "@sarthak/agent-shield";
import {
  AGENT_PRINCIPAL,
  AGENT_ROLES,
  type RunContext,
  buildShield,
  toPolicyRequest,
} from "../governance.js";

export { AGENT_PRINCIPAL, AGENT_ROLES };
import type { ManagedKillSwitch } from "../kill-switch.js";
import { ScriptedChatModel } from "../llm/scripted.js";
import type { AgentDeps, ToolGateway } from "../steps.js";

// Loaded once: the real Cedar policy set the agent enforces, for direct decisions.
const POLICIES = buildShield().shield.config.policies;

/** Evaluate a hand-built policy request against the real policy set. */
export function evaluatePolicy(req: PolicyEvaluationRequest): PolicyDecision {
  return evaluate(POLICIES, req);
}

/** Evaluate a tool call against the real policies, the way governedCall would. */
export function decide(
  server: string,
  tool: string,
  args: Record<string, unknown>,
  ctx: RunContext = {},
): "allow" | "deny" {
  return evaluate(POLICIES, toPolicyRequest(server, tool, args, ctx)).decision;
}

/**
 * A cross-tenant request through the real authorization path: the tenant-A agent
 * reads ACC-8, a tenant-B account. toPolicyRequest resolves the resource's tenant
 * from the fixtures, so policy 07 (ASI06) denies the crossing exactly as it does
 * at runtime — no hand-built entities.
 */
export function decideCrossTenant(): "allow" | "deny" {
  return decide("hubspot", "getAccount", { accountId: "ACC-8" });
}

/**
 * Offline, deterministic test harness for the eval suites. No network, no live
 * LLM, no Postgres: every case runs the real Cedar policies and the real
 * support-ops phases against scripted model output and a stub gateway, so the
 * suite is reproducible in CI and locally.
 */

export interface EvalCase {
  id: string;
  description: string;
  /** Returns true if the assertion holds. May throw; a throw counts as a fail. */
  run: () => Promise<boolean>;
}

export interface CaseResult {
  id: string;
  description: string;
  passed: boolean;
  error?: string;
}

export interface SuiteRun {
  suite: string;
  passed: number;
  total: number;
  cases: CaseResult[];
}

/** Run a suite's cases, turning throws into failures with a captured message. */
export async function runSuite(suite: string, cases: EvalCase[]): Promise<SuiteRun> {
  const results: CaseResult[] = [];
  for (const c of cases) {
    try {
      const passed = await c.run();
      results.push({ id: c.id, description: c.description, passed });
    } catch (err) {
      results.push({
        id: c.id,
        description: c.description,
        passed: false,
        error: (err as Error).message,
      });
    }
  }
  return {
    suite,
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    cases: results,
  };
}

/** A stub MCP gateway: returns canned data per `server.tool`, echoes otherwise. */
export function makeGateway(
  responses: Record<string, unknown> = {},
): ToolGateway & { calls: { server: string; tool: string }[] } {
  const calls: { server: string; tool: string }[] = [];
  return {
    calls,
    async callTool(server, tool, args): Promise<CallResult> {
      calls.push({ server, tool });
      const key = `${server}.${tool}`;
      const data = key in responses ? responses[key] : { server, tool, args };
      return { content: [{ type: "text", text: JSON.stringify(data) }], isError: false, data };
    },
    async listAllTools() {
      return {};
    },
  };
}

const TRIPPED_KILL_SWITCH: ManagedKillSwitch = {
  isTripped: async () => true,
  trip: async () => {},
  reset: async () => {},
};

export interface HarnessOptions {
  gateway?: ToolGateway;
  /** Scripted model turns: classification JSON, then the planner tool calls. */
  model?: ScriptedChatModel;
  /** Pass true to build a shield whose kill-switch is already tripped (ASI08). */
  killTripped?: boolean;
}

/** Build AgentDeps + the shield bundle for a case. */
export function harness(opts: HarnessOptions = {}) {
  const bundle = buildShield(opts.killTripped ? { killSwitch: TRIPPED_KILL_SWITCH } : {});
  const gateway = opts.gateway ?? makeGateway();
  const deps: AgentDeps = {
    shield: bundle.shield,
    gateway,
    llm: opts.model ?? new ScriptedChatModel([]),
  };
  return { deps, bundle, gateway };
}

/** Shorthand: a scripted model that classifies, then proposes the given tool calls. */
export function planner(
  classification: { category: string; customerFacing: boolean; summary: string },
  toolCalls: { name: string; args?: Record<string, unknown> }[],
): ScriptedChatModel {
  return new ScriptedChatModel([
    { content: JSON.stringify(classification) },
    { toolCalls: toolCalls.map((t, i) => ({ id: `c${i}`, name: t.name, args: t.args ?? {} })) },
  ]);
}

/** The PII values that must never survive a governed HubSpot read (policy 03). */
export const RAW_SSN = "123-45-6789";
export const RAW_CARD = "4242424242424242";
