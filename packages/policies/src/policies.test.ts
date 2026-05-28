import {
  type EntityRef,
  type PolicyEvaluationRequest,
  evaluate,
  formatDecision,
  loadPolicies,
} from "@sarthak/agent-shield";
import { describe, expect, it } from "vitest";
import { loadDefaultPolicies, policyFileNames } from "./index.js";

const supportLead: EntityRef = { type: "Role", id: "SupportLead" };
const engineer: EntityRef = { type: "Role", id: "Engineer" };

function alice(tenant = "tenant-A", role: EntityRef = supportLead) {
  return {
    uid: { type: "User", id: "alice" } as EntityRef,
    attrs: { tenant },
    parents: [role],
  };
}

function ticket(id: string, tenant = "tenant-A") {
  return { uid: { type: "Ticket", id } as EntityRef, attrs: { tenant }, parents: [] };
}

function kbPage(id: string, tag: string, tenant = "tenant-A") {
  return { uid: { type: "KBPage", id } as EntityRef, attrs: { tenant, tag }, parents: [] };
}

function account(id: string, tenant = "tenant-A") {
  return { uid: { type: "Account", id } as EntityRef, attrs: { tenant }, parents: [] };
}

function repo(name: string, tenant = "tenant-A") {
  return { uid: { type: "Repo", id: name } as EntityRef, attrs: { tenant, name }, parents: [] };
}

const files = loadDefaultPolicies();
const { policies, errors } = loadPolicies(files.map((p) => ({ id: p.id, text: p.text })));

describe("@gsa/policies — loadDefaultPolicies", () => {
  it("ships exactly 7 cedar files", () => {
    expect(policyFileNames()).toHaveLength(7);
    expect(files).toHaveLength(7);
  });

  it("every policy parses without errors", () => {
    expect(errors).toEqual([]);
    expect(policies).toHaveLength(7);
  });

  it("every policy carries an @asi annotation", () => {
    for (const p of policies) {
      expect(p.annotations.asi, `policy ${p.id} missing @asi annotation`).toBeTruthy();
    }
  });

  it("every policy carries a @description annotation", () => {
    for (const p of policies) {
      expect(p.annotations.description, `policy ${p.id} missing @description`).toBeTruthy();
    }
  });
});

describe("policy 01 — zendesk read-only", () => {
  function req(actionId: string): PolicyEvaluationRequest {
    return {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: actionId },
      resource: { type: "Ticket", id: "TCK-1" },
      entities: [alice(), ticket("TCK-1")],
    };
  }

  it("permits listTickets and getTicket", () => {
    expect(evaluate(policies, req("listTickets")).decision).toBe("allow");
    expect(evaluate(policies, req("getTicket")).decision).toBe("allow");
  });

  it("permits replyInternal and closeTicket", () => {
    expect(evaluate(policies, req("replyInternal")).decision).toBe("allow");
    expect(evaluate(policies, req("closeTicket")).decision).toBe("allow");
  });

  it("does not permit deleteUser (covered by policy 06)", () => {
    expect(evaluate(policies, req("deleteUser")).decision).toBe("deny");
  });
});

describe("policy 02 — notion tag-filtered", () => {
  function req(pageId: string, tag: string): PolicyEvaluationRequest {
    return {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "getPage" },
      resource: { type: "KBPage", id: pageId },
      entities: [alice(), kbPage(pageId, tag)],
    };
  }

  it("permits getPage when tag is public", () => {
    expect(evaluate(policies, req("p1", "public")).decision).toBe("allow");
  });

  it("permits getPage when tag is support-kb", () => {
    expect(evaluate(policies, req("p2", "support-kb")).decision).toBe("allow");
  });

  it("denies getPage on eng-only pages", () => {
    expect(evaluate(policies, req("p3", "eng-only")).decision).toBe("deny");
  });

  it("denies getPage on internal pages (the injection-payload bucket)", () => {
    expect(evaluate(policies, req("p4", "internal")).decision).toBe("deny");
  });
});

describe("policy 03 — hubspot pii-redacted", () => {
  function req(transform: string): PolicyEvaluationRequest {
    return {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "getAccount" },
      resource: { type: "Account", id: "ACC-1" },
      context: { responseTransform: transform },
      entities: [alice(), account("ACC-1")],
    };
  }

  it("permits getAccount when responseTransform is pii-redact", () => {
    expect(evaluate(policies, req("pii-redact")).decision).toBe("allow");
  });

  it("denies getAccount when responseTransform is missing or wrong", () => {
    expect(evaluate(policies, req("none")).decision).toBe("deny");
  });
});

describe("policy 04 — github write-scoped", () => {
  function req(repoName: string, severity: string): PolicyEvaluationRequest {
    return {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "createIssue" },
      resource: { type: "Repo", id: repoName },
      context: { severity },
      entities: [alice("tenant-A", engineer), repo(repoName)],
    };
  }

  it("permits createIssue on support repo for non-P0", () => {
    expect(evaluate(policies, req("support", "P2")).decision).toBe("allow");
  });

  it("denies P0 severity even on the support repo", () => {
    expect(evaluate(policies, req("support", "P0")).decision).toBe("deny");
  });

  it("denies write on a non-support repo", () => {
    expect(evaluate(policies, req("billing", "P2")).decision).toBe("deny");
  });

  it("denies a SupportLead trying to create issues (only Engineer permitted)", () => {
    const decision = evaluate(policies, {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "createIssue" },
      resource: { type: "Repo", id: "support" },
      context: { severity: "P2" },
      entities: [alice("tenant-A", supportLead), repo("support")],
    });
    expect(decision.decision).toBe("deny");
  });
});

describe("policy 05 — customer-facing requires approval", () => {
  function req(approvalState: string): PolicyEvaluationRequest {
    return {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "replyPublic" },
      resource: { type: "Ticket", id: "TCK-1" },
      context: { humanApprovalState: approvalState },
      entities: [alice(), ticket("TCK-1")],
    };
  }

  it("forbids replyPublic when approval is pending", () => {
    const decision = evaluate(policies, req("pending"));
    expect(decision.decision).toBe("deny");
    expect(
      decision.reasons.find((r) => r.policyId === "05-customer-facing-requires-approval"),
    ).toBeDefined();
  });

  it("default-denies replyPublic when approval is approved (no permit for replyPublic on the customer-facing path yet)", () => {
    expect(evaluate(policies, req("approved")).decision).toBe("deny");
  });
});

describe("policy 06 — delete account never (hard forbid)", () => {
  it("forbids hubspot:deleteAccount unconditionally", () => {
    const decision = evaluate(policies, {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "deleteAccount" },
      resource: { type: "Account", id: "ACC-9" },
      context: { humanApprovalState: "approved" },
      entities: [alice(), account("ACC-9")],
    });
    expect(decision.decision).toBe("deny");
    const forbid = decision.reasons.find((r) => r.policyId === "06-delete-account-never");
    expect(forbid?.effect).toBe("forbid");
    expect(forbid?.annotations.asi).toContain("ASI10");
  });

  it("forbids zendesk:deleteUser unconditionally", () => {
    const decision = evaluate(policies, {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "deleteUser" },
      resource: { type: "User", id: "u-9" },
      entities: [alice()],
    });
    expect(decision.decision).toBe("deny");
    expect(decision.reasons.find((r) => r.policyId === "06-delete-account-never")).toBeDefined();
  });
});

describe("policy 07 — tenant isolation", () => {
  it("forbids cross-tenant access even when an action is otherwise permitted", () => {
    const decision = evaluate(policies, {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "listTickets" },
      resource: { type: "Ticket", id: "TCK-B" },
      entities: [alice("tenant-A"), ticket("TCK-B", "tenant-B")],
    });
    expect(decision.decision).toBe("deny");
    const forbid = decision.reasons.find((r) => r.policyId === "07-tenant-isolation");
    expect(forbid?.effect).toBe("forbid");
    expect(forbid?.annotations.asi).toContain("ASI06");
  });

  it("permits same-tenant access for an otherwise-permitted action", () => {
    const decision = evaluate(policies, {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "listTickets" },
      resource: { type: "Ticket", id: "TCK-1" },
      entities: [alice("tenant-A"), ticket("TCK-1", "tenant-A")],
    });
    expect(decision.decision).toBe("allow");
  });
});

describe("formatDecision integration with real policies", () => {
  it("renders a forbid deny with the ASI ID and human-readable reason for delete-account", () => {
    const decision = evaluate(policies, {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "deleteAccount" },
      resource: { type: "Account", id: "ACC-9" },
      entities: [alice(), account("ACC-9")],
    });
    const formatted = formatDecision(decision);
    expect(formatted.summary).toContain("Denied");
    expect(formatted.summary).toContain("06-delete-account-never");
    expect(formatted.summary).toContain("ASI10");
    expect(formatted.asiIds).toContain("ASI10 Rogue Agents");
  });
});
