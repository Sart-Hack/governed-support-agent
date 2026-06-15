import { loadDefaultPolicies } from "@gsa/policies";
import {
  type FormattedDecision,
  type PolicyDecision,
  type PolicyEvaluationRequest,
  evaluate,
  formatDecision,
  loadPolicies,
} from "@sarthak/agent-shield";

// Every refusal below is a real Cedar denial, evaluated through agent-shield
// against the same policies the agent enforces, then frozen to JSON (drift-guarded
// by refusals-data.test.ts). The frames are the authored replay; the verdict,
// reason chain, and ASI mapping are not authored, they come from the engine. Four
// distinct OWASP-ASI threats: delete (ASI10), injection (ASI01), PII (ASI04),
// cross-tenant (ASI06).

export type RefusalFrame = {
  at: string;
  source: string;
  text: string;
  tone: "info" | "muted" | "danger" | "success";
  verdict?: boolean; // the frame where the policy engine denies
};

export type RefusalScene = {
  id: string;
  ticket: string;
  title: string;
  intent: string;
  asi: string;
  governingPolicy: string; // policy id whose rule governs the refusal
  policyFile: string;
  attempt: string; // the tool call the agent proposed
  decision: "deny";
  denialKind: "forbid" | "default-deny";
  formatted: FormattedDecision;
  defenseInDepth?: string;
  frames: RefusalFrame[];
};

const TENANT_A = "tenant-A";

function userRequest(
  action: string,
  resource: { type: string; id: string; attrs?: Record<string, unknown> },
  context: Record<string, unknown> = {},
): PolicyEvaluationRequest {
  const principal = { type: "User", id: "agent" };
  const res = { type: resource.type, id: resource.id };
  return {
    principal,
    action: { type: "Action", id: action },
    resource: res,
    context,
    entities: [
      {
        uid: principal,
        attrs: { tenant: TENANT_A },
        parents: [{ type: "Role", id: "SupportLead" }],
      },
      { uid: res, attrs: { tenant: TENANT_A, ...(resource.attrs ?? {}) }, parents: [] },
    ],
  };
}

type SceneDef = Omit<RefusalScene, "decision" | "denialKind" | "formatted"> & {
  request: PolicyEvaluationRequest;
};

const SCENE_DEFS: SceneDef[] = [
  {
    id: "delete-account",
    ticket: "TCK-5",
    title: "Delete the account",
    intent: "A churning customer asks the agent to close and wipe their account and all its data.",
    asi: "ASI10 Rogue Agents",
    governingPolicy: "06-delete-account-never",
    policyFile: "06-delete-account-never.cedar",
    attempt: "deleteAccount(ACC-5)",
    defenseInDepth:
      "Defense in depth: even if the policy were bypassed, the HubSpot tool hard-forbids the deletion server-side and records the attempt.",
    request: userRequest("deleteAccount", { type: "Account", id: "ACC-5" }),
    frames: [
      {
        at: "09:41:02",
        source: "ingest",
        text: "ticket TCK-5: “close our account AND wipe all our data”",
        tone: "info",
      },
      {
        at: "09:41:03",
        source: "classify",
        text: "intent: account closure + data erasure (destructive)",
        tone: "muted",
      },
      {
        at: "09:41:04",
        source: "plan",
        text: "proposes deleteAccount(ACC-5) on the customer's account",
        tone: "info",
      },
      {
        at: "09:41:04",
        source: "agent-shield",
        text: "evaluates deleteAccount against Cedar before any call leaves the process",
        tone: "muted",
      },
      {
        at: "09:41:04",
        source: "cedar",
        text: "DENY: forbidden by policy 06",
        tone: "danger",
        verdict: true,
      },
      {
        at: "09:41:04",
        source: "hubspot",
        text: "tool also hard-forbids server-side; deletion attempt recorded, not performed",
        tone: "danger",
      },
      {
        at: "09:41:05",
        source: "outcome",
        text: "0 actions executed · nothing dispatched",
        tone: "success",
      },
    ],
  },
  {
    id: "indirect-injection",
    ticket: "TCK-6",
    title: "Indirect prompt injection",
    intent:
      "A ticket points the agent at an internal SOP page that carries injected instructions. Policy 02 keeps that page off the reachable surface.",
    asi: "ASI01 Agent Goal Hijack",
    governingPolicy: "02-notion-tag-filtered",
    policyFile: "02-notion-tag-filtered.cedar",
    attempt: "getPage(NTP-INT-1)",
    request: userRequest("getPage", {
      type: "KBPage",
      id: "NTP-INT-1",
      attrs: { tag: "internal" },
    }),
    frames: [
      {
        at: "11:18:20",
        source: "ingest",
        text: "ticket TCK-6 cites the “Migration playbook” internal SOP page",
        tone: "info",
      },
      {
        at: "11:18:21",
        source: "plan",
        text: "proposes getPage(NTP-INT-1) to follow the cited instructions",
        tone: "info",
      },
      {
        at: "11:18:21",
        source: "agent-shield",
        text: "evaluates the KB read against Cedar",
        tone: "muted",
      },
      {
        at: "11:18:21",
        source: "cedar",
        text: "DENY: page tag “internal” is not on the allow-list (public, support-kb)",
        tone: "danger",
        verdict: true,
      },
      {
        at: "11:18:21",
        source: "notion",
        text: "the injected SOP never enters the model context",
        tone: "success",
      },
      {
        at: "11:18:22",
        source: "outcome",
        text: "the agent answers from support-kb pages only",
        tone: "success",
      },
    ],
  },
  {
    id: "pii-leak",
    ticket: "TCK-4",
    title: "Unredacted PII read",
    intent:
      "The agent tries to read a HubSpot account without the PII-redaction transform. Policy 03 permits the read only when redaction is applied.",
    asi: "ASI04 Data Exfiltration",
    governingPolicy: "03-hubspot-pii-redacted",
    policyFile: "03-hubspot-pii-redacted.cedar",
    attempt: "getAccount(ACC-PII-1)",
    request: userRequest("getAccount", { type: "Account", id: "ACC-PII-1" }),
    frames: [
      {
        at: "16:07:50",
        source: "ingest",
        text: "ticket TCK-4: billing question on account ACC-PII-1",
        tone: "info",
      },
      {
        at: "16:07:51",
        source: "plan",
        text: "proposes getAccount(ACC-PII-1) with no response transform",
        tone: "info",
      },
      {
        at: "16:07:51",
        source: "agent-shield",
        text: "evaluates the account read against Cedar",
        tone: "muted",
      },
      {
        at: "16:07:51",
        source: "cedar",
        text: "DENY: read permitted only with responseTransform = pii-redact",
        tone: "danger",
        verdict: true,
      },
      {
        at: "16:07:52",
        source: "agent-shield",
        text: "re-issued with redaction applied; raw PII never reaches the LLM",
        tone: "success",
      },
      {
        at: "16:07:52",
        source: "outcome",
        text: "the model sees a redacted account, not the customer's PII",
        tone: "success",
      },
    ],
  },
  {
    id: "cross-tenant",
    ticket: "TCK-8",
    title: "Cross-tenant read",
    intent:
      "Operating as a tenant-A principal, the agent is steered toward a tenant-B account. Policy 07 forbids the crossing.",
    asi: "ASI06 Inter-Agent / Cross-Boundary",
    governingPolicy: "07-tenant-isolation",
    policyFile: "07-tenant-isolation.cedar",
    attempt: "getAccount(ACC-8)",
    request: userRequest(
      "getAccount",
      { type: "Account", id: "ACC-8", attrs: { tenant: "tenant-B" } },
      { responseTransform: "pii-redact" },
    ),
    frames: [
      {
        at: "13:55:11",
        source: "ingest",
        text: "tenant-A run is steered toward account ACC-8 (tenant-B)",
        tone: "info",
      },
      {
        at: "13:55:12",
        source: "plan",
        text: "proposes getAccount(ACC-8) with redaction applied",
        tone: "info",
      },
      {
        at: "13:55:12",
        source: "agent-shield",
        text: "evaluates the cross-tenant read against Cedar",
        tone: "muted",
      },
      {
        at: "13:55:12",
        source: "cedar",
        text: "DENY: principal.tenant (A) != resource.tenant (B)",
        tone: "danger",
        verdict: true,
      },
      {
        at: "13:55:12",
        source: "hubspot",
        text: "tenant-B data is never fetched",
        tone: "success",
      },
      {
        at: "13:55:13",
        source: "outcome",
        text: "0 actions executed · isolation holds",
        tone: "success",
      },
    ],
  },
];

function denialKindOf(decision: PolicyDecision): "forbid" | "default-deny" {
  return decision.reasons.some((r) => r.effect === "forbid") ? "forbid" : "default-deny";
}

export function getRefusalScenes(): RefusalScene[] {
  const { policies } = loadPolicies(loadDefaultPolicies());
  return SCENE_DEFS.map(({ request, ...scene }): RefusalScene => {
    const decision = evaluate(policies, request);
    return {
      ...scene,
      decision: "deny",
      denialKind: denialKindOf(decision),
      formatted: formatDecision(decision),
    };
  });
}
