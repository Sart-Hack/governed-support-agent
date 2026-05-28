import { describe, expect, it } from "vitest";
import { evaluate, loadPolicies } from "./evaluator.js";

const POLICY_READONLY = `
@asi("ASI02")
@description("SupportLead reads tickets, never deletes.")
permit (
  principal in Role::"SupportLead",
  action in [Action::"listTickets", Action::"getTicket"],
  resource is Ticket
);
`;

const POLICY_DELETE_FORBID = `
@asi("ASI10")
@description("Hard forbid on hubspot:deleteAccount and zendesk:deleteUser.")
forbid (
  principal,
  action in [Action::"deleteAccount", Action::"deleteUser"],
  resource
);
`;

const POLICY_APPROVAL_REQUIRED = `
@asi("ASI03")
@description("Customer-facing actions require human approval.")
forbid (
  principal,
  action in [Action::"replyPublic"],
  resource
) when {
  context.humanApprovalState != "approved"
};
`;

const aliceAsSupportLead = {
  uid: { type: "User", id: "alice" },
  attrs: {},
  parents: [{ type: "Role", id: "SupportLead" }],
};

describe("loadPolicies", () => {
  it("extracts effect and annotations from each policy", () => {
    const { policies, errors } = loadPolicies([
      { id: "01-zendesk-read-only", text: POLICY_READONLY },
      { id: "06-delete-account-never", text: POLICY_DELETE_FORBID },
    ]);

    expect(errors).toEqual([]);
    expect(policies).toHaveLength(2);

    const readonly = policies.find((p) => p.id === "01-zendesk-read-only");
    expect(readonly?.effect).toBe("permit");
    expect(readonly?.annotations.asi).toBe("ASI02");
    expect(readonly?.annotations.description).toContain("never deletes");

    const forbid = policies.find((p) => p.id === "06-delete-account-never");
    expect(forbid?.effect).toBe("forbid");
    expect(forbid?.annotations.asi).toBe("ASI10");
  });

  it("collects errors for malformed policies without throwing", () => {
    const { policies, errors } = loadPolicies([
      { id: "good", text: POLICY_READONLY },
      { id: "bad", text: "this is not Cedar syntax" },
    ]);
    expect(policies).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.id).toBe("bad");
  });
});

describe("evaluate", () => {
  const { policies } = loadPolicies([
    { id: "01-zendesk-read-only", text: POLICY_READONLY },
    { id: "06-delete-account-never", text: POLICY_DELETE_FORBID },
    { id: "05-customer-facing-requires-approval", text: POLICY_APPROVAL_REQUIRED },
  ]);

  it("allows SupportLead to listTickets", () => {
    const decision = evaluate(policies, {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "listTickets" },
      resource: { type: "Ticket", id: "TCK-1" },
      entities: [aliceAsSupportLead],
    });
    expect(decision.decision).toBe("allow");
    expect(decision.reasons.map((r) => r.policyId)).toContain("01-zendesk-read-only");
  });

  it("default-denies when no permit matches", () => {
    const decision = evaluate(policies, {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "listTickets" },
      resource: { type: "Ticket", id: "TCK-1" },
      entities: [{ uid: { type: "User", id: "alice" }, attrs: {}, parents: [] }],
    });
    expect(decision.decision).toBe("deny");
    expect(decision.reasons).toEqual([]);
  });

  it("forbids deleteAccount even for permitted principals", () => {
    const decision = evaluate(policies, {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "deleteAccount" },
      resource: { type: "Account", id: "ACC-9" },
      entities: [aliceAsSupportLead],
    });
    expect(decision.decision).toBe("deny");
    const forbid = decision.reasons.find((r) => r.effect === "forbid");
    expect(forbid?.policyId).toBe("06-delete-account-never");
    expect(forbid?.annotations.asi).toBe("ASI10");
  });

  it("blocks replyPublic when human approval is missing", () => {
    const decision = evaluate(policies, {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "replyPublic" },
      resource: { type: "Ticket", id: "TCK-1" },
      context: { humanApprovalState: "pending" },
      entities: [aliceAsSupportLead],
    });
    expect(decision.decision).toBe("deny");
    const forbid = decision.reasons.find((r) => r.effect === "forbid");
    expect(forbid?.policyId).toBe("05-customer-facing-requires-approval");
  });

  it("permits replyPublic once approval is granted (but only if a permit exists for it)", () => {
    const { policies: withPublicPermit } = loadPolicies([
      { id: "01-zendesk-read-only", text: POLICY_READONLY },
      { id: "06-delete-account-never", text: POLICY_DELETE_FORBID },
      { id: "05-customer-facing-requires-approval", text: POLICY_APPROVAL_REQUIRED },
      {
        id: "00-test-permit-replypublic",
        text: `permit ( principal in Role::"SupportLead", action == Action::"replyPublic", resource is Ticket );`,
      },
    ]);

    const decision = evaluate(withPublicPermit, {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "replyPublic" },
      resource: { type: "Ticket", id: "TCK-1" },
      context: { humanApprovalState: "approved" },
      entities: [aliceAsSupportLead],
    });
    expect(decision.decision).toBe("allow");
  });
});
