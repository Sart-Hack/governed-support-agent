import * as cedar from "@cedar-policy/cedar-wasm/nodejs";
import type {
  Entity,
  LoadedPolicy,
  PolicyAnnotations,
  PolicyDecision,
  PolicyEvaluationError,
  PolicyEvaluationRequest,
  PolicyLoadError,
  PolicyReason,
} from "./types.js";

export interface LoadResult {
  policies: LoadedPolicy[];
  errors: PolicyLoadError[];
}

export function loadPolicies(input: { id: string; text: string }[]): LoadResult {
  const policies: LoadedPolicy[] = [];
  const errors: PolicyLoadError[] = [];

  for (const { id, text } of input) {
    const parsed = cedar.policyToJson(text);
    if (parsed.type === "failure") {
      const message = parsed.errors.map((e) => e.message).join("; ");
      errors.push({ id, message });
      continue;
    }
    const annotations = normalizeAnnotations(parsed.json.annotations);
    policies.push({ id, text, effect: parsed.json.effect, annotations });
  }

  return { policies, errors };
}

export function evaluate(
  policies: LoadedPolicy[],
  request: PolicyEvaluationRequest,
): PolicyDecision {
  const byId = new Map<string, LoadedPolicy>();
  const staticPolicies: Record<string, string> = {};
  for (const p of policies) {
    byId.set(p.id, p);
    staticPolicies[p.id] = p.text;
  }

  const answer = cedar.isAuthorized({
    principal: request.principal,
    action: request.action,
    resource: request.resource,
    context: (request.context ?? {}) as cedar.Context,
    policies: { staticPolicies },
    entities: toCedarEntities(request.entities ?? []),
  });

  if (answer.type === "failure") {
    return {
      decision: "deny",
      reasons: [],
      errors: answer.errors.map((e) => ({ policyId: "*", message: e.message })),
      request,
    };
  }

  const reasons: PolicyReason[] = answer.response.diagnostics.reason
    .map((pid) => {
      const p = byId.get(pid);
      if (!p) return null;
      const reason: PolicyReason = {
        policyId: pid,
        effect: p.effect,
        annotations: p.annotations,
      };
      return reason;
    })
    .filter((r): r is PolicyReason => r !== null);

  const errors: PolicyEvaluationError[] = answer.response.diagnostics.errors.map((e) => ({
    policyId: e.policyId,
    message: e.error.message,
  }));

  return {
    decision: answer.response.decision,
    reasons,
    errors,
    request,
  };
}

function normalizeAnnotations(raw: Record<string, string> | undefined): PolicyAnnotations {
  if (!raw) return {};
  const out: PolicyAnnotations = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = v;
  }
  return out;
}

function toCedarEntities(entities: Entity[]): cedar.Entities {
  return entities.map((e) => ({
    uid: e.uid,
    attrs: (e.attrs ?? {}) as Record<string, cedar.CedarValueJson>,
    parents: e.parents ?? [],
  }));
}
