import { describe, expect, it } from "vitest";
import { type Cell, type Role, getPermissionMatrix } from "./permissions";

const matrix = getPermissionMatrix();

function cell(server: string, action: string, role: Role): Cell {
  const group = matrix.groups.find((g) => g.server === server);
  const row = group?.rows.find((r) => r.action === action);
  const idx = matrix.roles.indexOf(role);
  const found = row?.cells[idx];
  if (!found) throw new Error(`no cell for ${server}.${action} / ${role}`);
  return found;
}

describe("permission matrix (real Cedar decisions)", () => {
  it("covers both agent roles and every MCP server", () => {
    expect(matrix.roles).toEqual(["SupportLead", "Engineer"]);
    expect(matrix.groups.map((g) => g.server)).toEqual(["zendesk", "notion", "hubspot", "github"]);
  });

  it("allows unconditional SupportLead reads via policy 01", () => {
    const c = cell("zendesk", "listTickets", "SupportLead");
    expect(c.state).toBe("allow");
    expect(c.policyNum).toBe("01");
  });

  it("marks customer-facing reply conditional on approval via policy 08", () => {
    const c = cell("zendesk", "replyPublic", "SupportLead");
    expect(c.state).toBe("conditional");
    expect(c.policyNum).toBe("08");
    expect(c.asi).toContain("ASI03");
  });

  it("hard-denies destructive deletes via policy 06", () => {
    expect(cell("zendesk", "deleteUser", "SupportLead").policyNum).toBe("06");
    expect(cell("hubspot", "deleteAccount", "SupportLead").state).toBe("deny");
    expect(cell("hubspot", "deleteAccount", "SupportLead").policyNum).toBe("06");
  });

  it("gates KB search on tag (policy 02) and account reads on redaction (policy 03)", () => {
    expect(cell("notion", "search", "SupportLead").state).toBe("conditional");
    expect(cell("notion", "search", "SupportLead").policyNum).toBe("02");
    expect(cell("hubspot", "getAccount", "SupportLead").state).toBe("conditional");
    expect(cell("hubspot", "getAccount", "SupportLead").policyNum).toBe("03");
  });

  it("scopes GitHub writes to Engineer (policy 04), default-denies SupportLead", () => {
    const eng = cell("github", "createIssue", "Engineer");
    expect(eng.state).toBe("conditional");
    expect(eng.policyNum).toBe("04");
    const lead = cell("github", "createIssue", "SupportLead");
    expect(lead.state).toBe("deny");
    expect(lead.policyId).toBe("default-deny");
  });

  it("default-denies Engineer on SupportLead-only Zendesk actions", () => {
    const c = cell("zendesk", "listTickets", "Engineer");
    expect(c.state).toBe("deny");
    expect(c.policyId).toBe("default-deny");
  });
});
