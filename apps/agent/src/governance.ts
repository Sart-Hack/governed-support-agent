import { HUBSPOT_ACCOUNTS } from "@gsa/fixtures";
import { McpClientPool, defaultMcpTargets } from "@gsa/mcp-client";
import { loadDefaultPolicies } from "@gsa/policies";
import {
  type AuditSink,
  type EntityRef,
  GrantedScopeCheck,
  InMemoryAuditSink,
  NoopKillSwitch,
  type PolicyEvaluationRequest,
  type Shield,
  createBreaker,
  loadPolicies,
  shield,
} from "@sarthak/agent-shield";
import { type ManagedKillSwitch, createKillSwitch } from "./kill-switch.js";

// The demo principal: the agent acts as a SupportLead in tenant-A. Cedar
// policies key off this — SupportLead may read/triage/internal-reply, but
// customer-facing replies need approval (05) and deletes are hard-forbidden (06).
export const AGENT_PRINCIPAL: EntityRef = { type: "User", id: "alice" };
// The agent is a support engineer: it triages tickets (SupportLead, policy 01)
// and files issues in the support repo (Engineer, policy 04).
export const AGENT_ROLES: EntityRef[] = [
  { type: "Role", id: "SupportLead" },
  { type: "Role", id: "Engineer" },
];
export const AGENT_TENANT = "tenant-A";

// Least-privilege grant for the principal: reads + internal replies + issue
// writes, but NOT customer-facing replies (reply:public) or destructive deletes.
// These missing scopes are the scope-check's half of defense-in-depth with Cedar.
export const AGENT_SCOPES = [
  "zendesk:read",
  "zendesk:reply:internal",
  // The public-reply tool IS in the agent's toolbelt; Cedar (policy 05/08), not a
  // withheld scope, is what gates it on human approval.
  "zendesk:reply:public",
  "zendesk:write",
  "notion:read",
  "hubspot:read",
  "github:read",
  "github:issues:write",
];

// MCP server name -> Cedar resource entity type.
const RESOURCE_TYPE: Record<string, string> = {
  zendesk: "Ticket",
  notion: "KBPage",
  hubspot: "Account",
  github: "Repo",
};

export interface RunContext {
  /** "approved" once a human has approved a customer-facing action (policy 05). */
  humanApprovalState?: string;
  /** Tenant the run operates in. Defaults to the agent's tenant. */
  tenant?: string;
}

/**
 * Translate an MCP tool call into the Cedar authorization request agent-shield
 * evaluates. Action id == tool name (the policies are authored against the tool
 * vocabulary); resource type/attrs and the policy context are derived per server
 * so the relevant policy's `when` clause can decide.
 */
export function toPolicyRequest(
  server: string,
  tool: string,
  args: Record<string, unknown>,
  runCtx: RunContext = {},
): PolicyEvaluationRequest {
  const principalTenant = runCtx.tenant ?? AGENT_TENANT;
  const resourceType = RESOURCE_TYPE[server] ?? "Resource";
  const resourceId = resourceIdFor(server, args);

  // The resource's tenant. For a HubSpot account it is the account's own tenant
  // (from the fixtures), so reading another tenant's account trips policy 07
  // (ASI06 tenant isolation) at runtime. Every other resource in this single-
  // tenant demo surface shares the agent's tenant, so the check is a no-op there.
  const resourceTenant =
    server === "hubspot"
      ? (HUBSPOT_ACCOUNTS.find((a) => a.id === resourceId)?.tenant ?? principalTenant)
      : principalTenant;

  const resourceAttrs: Record<string, unknown> = { tenant: resourceTenant };
  const context: Record<string, unknown> = {};

  if (server === "notion") {
    // Policy 02 gates on the page tag. The agent only reads the support-kb and
    // public surfaces; default to support-kb when a search doesn't pin a tag.
    resourceAttrs.tag = (args.tag as string) ?? "support-kb";
  }
  if (server === "hubspot") {
    // Policy 03 permits account reads only when redaction is applied.
    context.responseTransform = "pii-redact";
  }
  if (server === "github") {
    resourceAttrs.name = (args.repo as string) ?? "support";
    context.severity = (args.severity as string) ?? "P2";
  }
  if (tool === "replyPublic" || tool === "sendEmail") {
    context.humanApprovalState = runCtx.humanApprovalState ?? "pending";
  }

  return {
    principal: AGENT_PRINCIPAL,
    action: { type: "Action", id: tool },
    resource: { type: resourceType, id: resourceId },
    context,
    entities: [
      { uid: AGENT_PRINCIPAL, attrs: { tenant: principalTenant }, parents: AGENT_ROLES },
      { uid: { type: resourceType, id: resourceId }, attrs: resourceAttrs, parents: [] },
    ],
  };
}

function resourceIdFor(server: string, args: Record<string, unknown>): string {
  const candidate =
    (args.ticketId as string) ??
    (args.id as string) ??
    (args.accountId as string) ??
    (args.repo as string);
  if (candidate) return candidate;
  // List/search ops have no single resource; a wildcard id still satisfies the
  // `resource is <Type>` head and the tenant check via attrs.
  return server === "notion" ? "kb-search" : "*";
}

export interface Governance {
  shield: Shield;
  pool: McpClientPool;
  audit: AuditSink;
  close(): Promise<void>;
}

export interface BuildGovernanceOptions {
  runId?: string;
  /** Audit sink for the shield and pool. Defaults to a fresh InMemoryAuditSink. */
  audit?: AuditSink;
  /** Cost ceiling for the circuit breaker. Defaults to $0.50 (BUILD-SPEC). */
  costCeilingUsd?: number;
  /** Kill-switch. Defaults to NoopKillSwitch (offline/tests); buildGovernance uses Postgres. */
  killSwitch?: ManagedKillSwitch;
}

export interface ShieldBundle {
  shield: Shield;
  audit: AuditSink;
  scopeCheck: GrantedScopeCheck;
  killSwitch: ManagedKillSwitch;
}

/**
 * Assemble the shield (Cedar policies + audit + kill-switch + circuit-breaker +
 * scope-check) without any network. Tests use this directly; buildGovernance
 * adds the connected MCP pool on top.
 */
export function buildShield(opts: BuildGovernanceOptions = {}): ShieldBundle {
  const files = loadDefaultPolicies();
  const { policies, errors } = loadPolicies(files.map((f) => ({ id: f.id, text: f.text })));
  if (errors.length > 0) {
    throw new Error(`policy load errors: ${errors.map((e) => `${e.id}: ${e.message}`).join("; ")}`);
  }

  const audit = opts.audit ?? new InMemoryAuditSink();
  const scopeCheck = new GrantedScopeCheck(AGENT_SCOPES);
  const killSwitch = opts.killSwitch ?? new NoopKillSwitch();
  const breaker = createBreaker({
    costCeilingUsd: opts.costCeilingUsd ?? 0.5,
    duplicateToolCallLimit: 3,
  });

  return {
    shield: shield({ policies, audit, killSwitch, scopeCheck, breaker }),
    audit,
    scopeCheck,
    killSwitch,
  };
}

/**
 * Assemble the full governance layer: the shield plus a connected MCP client
 * pool sharing the same scope-check and audit sink, with a Postgres-backed
 * kill-switch. This is `shield({...})` from the spec, ready to drive the workflow.
 */
export async function buildGovernance(opts: BuildGovernanceOptions = {}): Promise<Governance> {
  const killSwitch = opts.killSwitch ?? createKillSwitch();
  const { shield: theShield, audit, scopeCheck } = buildShield({ ...opts, killSwitch });
  const pool = await McpClientPool.connect({
    targets: defaultMcpTargets(),
    scopeCheck,
    audit,
    runId: opts.runId,
  });

  return {
    shield: theShield,
    pool,
    audit,
    close: async () => {
      await pool.closeAll();
      await killSwitch.close?.();
    },
  };
}
