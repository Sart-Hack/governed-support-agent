import { HUBSPOT_ACCOUNTS } from "@gsa/fixtures";
import { loadDefaultPolicies } from "@gsa/policies";
import {
  type FormattedDecision,
  type PolicyEvaluationRequest,
  evaluate,
  formatDecision,
  loadPolicies,
} from "@sarthak/agent-shield";

// The /tenants proof is not hand-written. Both rows below are real Cedar decisions
// from policy 07 (tenant isolation), evaluated through agent-shield against the
// same fixture accounts the agent reads. The two requests are identical except for
// the resource's tenant, so the only thing that flips allow -> deny is policy 07.
// Same precompute-to-JSON + drift-test pattern as /permissions, because cedar-wasm
// cannot run inside the Next build.

const PRINCIPAL_TENANT = "tenant-A";
const SAME_TENANT_ACCOUNT = "ACC-1"; // tenant-A
const CROSS_TENANT_ACCOUNT = "ACC-8"; // tenant-B

export type TenantScenario = {
  key: "same-tenant" | "cross-tenant";
  title: string;
  caption: string;
  principalTenant: string;
  resource: { id: string; name: string; tenant: string };
  action: string;
  decision: "allow" | "deny";
  formatted: FormattedDecision;
};

export type TenantProof = { principalTenant: string; scenarios: TenantScenario[] };

function accountName(id: string): string {
  return HUBSPOT_ACCOUNTS.find((a) => a.id === id)?.name ?? id;
}

// A SupportLead reading a HubSpot account with PII redaction applied. Policy 03
// permits this read; policy 07 forbids it the moment the tenants differ.
function requestFor(account: { id: string; tenant: string }): PolicyEvaluationRequest {
  const principal = { type: "User", id: "agent" };
  const resource = { type: "Account", id: account.id };
  return {
    principal,
    action: { type: "Action", id: "getAccount" },
    resource,
    context: { responseTransform: "pii-redact" },
    entities: [
      {
        uid: principal,
        attrs: { tenant: PRINCIPAL_TENANT },
        parents: [{ type: "Role", id: "SupportLead" }],
      },
      { uid: resource, attrs: { tenant: account.tenant }, parents: [] },
    ],
  };
}

function scenario(
  key: TenantScenario["key"],
  title: string,
  caption: string,
  accountId: string,
  tenant: string,
): TenantScenario {
  const { policies } = loadPolicies(loadDefaultPolicies());
  const account = { id: accountId, tenant };
  const decision = evaluate(policies, requestFor(account));
  return {
    key,
    title,
    caption,
    principalTenant: PRINCIPAL_TENANT,
    resource: { id: accountId, name: accountName(accountId), tenant },
    action: "getAccount",
    decision: decision.decision,
    formatted: formatDecision(decision),
  };
}

export function getTenantProof(): TenantProof {
  return {
    principalTenant: PRINCIPAL_TENANT,
    scenarios: [
      scenario(
        "same-tenant",
        "Same tenant",
        "The agent acts as a tenant-A principal on a tenant-A account. The read is permitted (policy 03, with PII redaction applied).",
        SAME_TENANT_ACCOUNT,
        "tenant-A",
      ),
      scenario(
        "cross-tenant",
        "Cross tenant",
        "The identical request against a tenant-B account is denied. Only the resource tenant changed; policy 07 forbids the crossing.",
        CROSS_TENANT_ACCOUNT,
        "tenant-B",
      ),
    ],
  };
}
