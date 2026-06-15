import { loadDefaultPolicies } from "@gsa/policies";
import {
  type LoadedPolicy,
  type PolicyEvaluationRequest,
  evaluate,
  loadPolicies,
} from "@sarthak/agent-shield";

// The permission matrix is not hand-authored. Each cell is a real Cedar decision
// from the same policies the agent enforces, evaluated under the agent's own
// permissive context. A cell is "conditional" when it is allowed but the deciding
// permit policy carries a `when {}` clause (approval, redaction, tag, severity).

export type Role = "SupportLead" | "Engineer";
export type CellState = "allow" | "deny" | "conditional";

export const ROLES: Role[] = ["SupportLead", "Engineer"];

const TENANT = "tenant-A";

type ActionSpec = {
  server: string;
  resourceType: string;
  action: string;
  resourceAttrs?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

// The tool vocabulary the policies are written against, grouped by MCP server.
// resourceAttrs/context mirror governance.ts toPolicyRequest's permissive path so
// conditional permits can match (the agent supplies exactly these values).
const ACTIONS: ActionSpec[] = [
  { server: "zendesk", resourceType: "Ticket", action: "listTickets" },
  { server: "zendesk", resourceType: "Ticket", action: "getTicket" },
  { server: "zendesk", resourceType: "Ticket", action: "replyInternal" },
  { server: "zendesk", resourceType: "Ticket", action: "closeTicket" },
  {
    server: "zendesk",
    resourceType: "Ticket",
    action: "replyPublic",
    context: { humanApprovalState: "approved" },
  },
  { server: "zendesk", resourceType: "Ticket", action: "deleteUser" },
  {
    server: "notion",
    resourceType: "KBPage",
    action: "search",
    resourceAttrs: { tag: "support-kb" },
  },
  {
    server: "notion",
    resourceType: "KBPage",
    action: "getPage",
    resourceAttrs: { tag: "support-kb" },
  },
  {
    server: "hubspot",
    resourceType: "Account",
    action: "getAccount",
    context: { responseTransform: "pii-redact" },
  },
  {
    server: "hubspot",
    resourceType: "Account",
    action: "listContacts",
    context: { responseTransform: "pii-redact" },
  },
  { server: "hubspot", resourceType: "Account", action: "deleteAccount" },
  {
    server: "github",
    resourceType: "Repo",
    action: "createIssue",
    resourceAttrs: { name: "support" },
    context: { severity: "P2" },
  },
  {
    server: "github",
    resourceType: "Repo",
    action: "updateIssue",
    resourceAttrs: { name: "support" },
    context: { severity: "P2" },
  },
  {
    server: "github",
    resourceType: "Repo",
    action: "listProjects",
    resourceAttrs: { name: "support" },
    context: { severity: "P2" },
  },
];

export type Cell = {
  state: CellState;
  policyId: string; // deciding policy id, or "default-deny"
  policyNum: string; // "08", or "" for default-deny
  asi: string; // "ASI03 Delegated Trust", or ""
};

export type ActionRow = { action: string; cells: Cell[] }; // cells indexed by ROLES
export type ServerGroup = { server: string; resourceType: string; rows: ActionRow[] };
export type Matrix = { roles: Role[]; groups: ServerGroup[] };

function requestFor(role: Role, spec: ActionSpec): PolicyEvaluationRequest {
  const principal = { type: "User", id: "agent" };
  const resource = { type: spec.resourceType, id: "*" };
  return {
    principal,
    action: { type: "Action", id: spec.action },
    resource,
    context: spec.context ?? {},
    entities: [
      { uid: principal, attrs: { tenant: TENANT }, parents: [{ type: "Role", id: role }] },
      {
        uid: resource,
        attrs: { tenant: TENANT, ...(spec.resourceAttrs ?? {}) },
        parents: [],
      },
    ],
  };
}

function cellFor(role: Role, spec: ActionSpec, policies: LoadedPolicy[]): Cell {
  const byId = new Map(policies.map((p) => [p.id, p]));
  const decision = evaluate(policies, requestFor(role, spec));

  if (decision.decision === "deny") {
    const forbid = decision.reasons.find((r) => r.effect === "forbid");
    return forbid
      ? {
          state: "deny",
          policyId: forbid.policyId,
          policyNum: forbid.policyId.match(/^(\d+)/)?.[1] ?? "",
          asi: forbid.annotations.asi ?? "",
        }
      : { state: "deny", policyId: "default-deny", policyNum: "", asi: "" };
  }

  const permit = decision.reasons.find((r) => r.effect === "permit");
  const text = permit ? (byId.get(permit.policyId)?.text ?? "") : "";
  const gated = /\bwhen\s*\{/.test(text);
  return {
    state: gated ? "conditional" : "allow",
    policyId: permit?.policyId ?? "",
    policyNum: permit?.policyId.match(/^(\d+)/)?.[1] ?? "",
    asi: permit?.annotations.asi ?? "",
  };
}

export function getPermissionMatrix(): Matrix {
  const { policies } = loadPolicies(loadDefaultPolicies());

  const groups: ServerGroup[] = [];
  for (const spec of ACTIONS) {
    let group = groups.find((g) => g.server === spec.server);
    if (!group) {
      group = { server: spec.server, resourceType: spec.resourceType, rows: [] };
      groups.push(group);
    }
    group.rows.push({
      action: spec.action,
      cells: ROLES.map((role) => cellFor(role, spec, policies)),
    });
  }

  return { roles: ROLES, groups };
}
