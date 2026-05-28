import { describe, expect, it } from "vitest";
import { evaluate, loadPolicies } from "./evaluator.js";
import { formatDecision } from "./format-decision.js";

const POLICY_DELETE_FORBID = `
@asi("ASI10")
@description("Hard forbid on hubspot:deleteAccount and zendesk:deleteUser.")
forbid (
  principal,
  action in [Action::"deleteAccount", Action::"deleteUser"],
  resource
);
`;

const POLICY_READ = `
@asi("ASI02")
@description("SupportLead reads tickets.")
permit (
  principal in Role::"SupportLead",
  action == Action::"listTickets",
  resource is Ticket
);
`;

describe("formatDecision", () => {
  it("renders a forbid deny with policy id, ASI id, and description", () => {
    const { policies } = loadPolicies([
      { id: "06-delete-account-never", text: POLICY_DELETE_FORBID },
    ]);
    const decision = evaluate(policies, {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "deleteAccount" },
      resource: { type: "Account", id: "ACC-9" },
      entities: [],
    });

    const formatted = formatDecision(decision);
    expect(formatted.summary).toContain("Denied");
    expect(formatted.summary).toContain("06-delete-account-never");
    expect(formatted.summary).toContain("ASI10");
    expect(formatted.summary).toContain("Hard forbid");
    expect(formatted.reasonLines).toHaveLength(1);
    expect(formatted.reasonLines[0]).toContain("[FORBID]");
    expect(formatted.asiIds).toEqual(["ASI10"]);
  });

  it("renders a default deny when no policy applies", () => {
    const { policies } = loadPolicies([
      { id: "06-delete-account-never", text: POLICY_DELETE_FORBID },
    ]);
    const decision = evaluate(policies, {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "listTickets" },
      resource: { type: "Ticket", id: "TCK-1" },
      entities: [],
    });
    const formatted = formatDecision(decision);
    expect(formatted.summary).toContain("default deny");
    expect(formatted.reasonLines).toEqual([]);
    expect(formatted.asiIds).toEqual([]);
  });

  it("renders an allow with the deciding policy and its annotations", () => {
    const { policies } = loadPolicies([{ id: "01-zendesk-read-only", text: POLICY_READ }]);
    const decision = evaluate(policies, {
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "listTickets" },
      resource: { type: "Ticket", id: "TCK-1" },
      entities: [
        {
          uid: { type: "User", id: "alice" },
          attrs: {},
          parents: [{ type: "Role", id: "SupportLead" }],
        },
      ],
    });
    const formatted = formatDecision(decision);
    expect(formatted.summary).toContain("Allowed");
    expect(formatted.summary).toContain("01-zendesk-read-only");
    expect(formatted.summary).toContain("ASI02");
    expect(formatted.asiIds).toEqual(["ASI02"]);
  });
});
