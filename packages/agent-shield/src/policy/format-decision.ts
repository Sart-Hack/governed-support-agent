import type { PolicyDecision, PolicyReason } from "./types.js";

export interface FormattedDecision {
  summary: string;
  reasonLines: string[];
  asiIds: string[];
}

export function formatDecision(decision: PolicyDecision): FormattedDecision {
  const { principal, action, resource } = decision.request;
  const subject = `${principal.type}::"${principal.id}"`;
  const verb = `${action.type}::"${action.id}"`;
  const object = `${resource.type}::"${resource.id}"`;

  const forbids = decision.reasons.filter((r) => r.effect === "forbid");
  const permits = decision.reasons.filter((r) => r.effect === "permit");
  const asiIds = uniqueAsi(decision.reasons);

  if (decision.decision === "deny" && forbids.length > 0) {
    const primary = forbids[0];
    if (!primary) {
      return makeUnreachableDeny(subject, verb, object);
    }
    return {
      summary: `Denied: ${subject} ${verb} on ${object} — forbidden by policy ${primary.policyId}${describe(primary)}.`,
      reasonLines: forbids.map((r) => reasonLine(r)),
      asiIds,
    };
  }

  if (decision.decision === "deny") {
    return {
      summary: `Denied: ${subject} ${verb} on ${object} — no policy permits this action (default deny).`,
      reasonLines: [],
      asiIds: [],
    };
  }

  if (permits.length > 0) {
    const primary = permits[0];
    if (!primary) {
      return {
        summary: `Allowed: ${subject} ${verb} on ${object}.`,
        reasonLines: [],
        asiIds,
      };
    }
    return {
      summary: `Allowed: ${subject} ${verb} on ${object} — policy ${primary.policyId}${describe(primary)}.`,
      reasonLines: permits.map((r) => reasonLine(r)),
      asiIds,
    };
  }

  return {
    summary: `Allowed: ${subject} ${verb} on ${object}.`,
    reasonLines: [],
    asiIds: [],
  };
}

function describe(reason: PolicyReason): string {
  const parts: string[] = [];
  if (reason.annotations.asi) parts.push(reason.annotations.asi);
  if (reason.annotations.description) parts.push(reason.annotations.description);
  return parts.length > 0 ? ` (${parts.join(" — ")})` : "";
}

function reasonLine(reason: PolicyReason): string {
  const tag = reason.effect === "forbid" ? "FORBID" : "PERMIT";
  const desc = reason.annotations.description ?? "";
  const asi = reason.annotations.asi ?? "";
  const tail = [asi, desc].filter(Boolean).join(" — ");
  return tail ? `[${tag}] ${reason.policyId}: ${tail}` : `[${tag}] ${reason.policyId}`;
}

function uniqueAsi(reasons: PolicyReason[]): string[] {
  const seen = new Set<string>();
  for (const r of reasons) {
    if (r.annotations.asi) seen.add(r.annotations.asi);
  }
  return Array.from(seen);
}

function makeUnreachableDeny(subject: string, verb: string, object: string): FormattedDecision {
  return {
    summary: `Denied: ${subject} ${verb} on ${object}.`,
    reasonLines: [],
    asiIds: [],
  };
}
