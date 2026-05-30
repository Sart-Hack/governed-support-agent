import { PII_ACCOUNT_IDS } from "@gsa/fixtures";
import { describe, expect, it } from "vitest";
import { createState, tools } from "./tools.js";

function findTool(name: string, state = createState()) {
  const def = tools(state).find((t) => t.name === name);
  if (!def) throw new Error(`tool ${name} missing`);
  return { state, tool: def };
}

describe("hubspot getAccount", () => {
  it("returns a known account with unredacted notes (redaction is upstream)", async () => {
    const { tool } = findTool("getAccount");
    const r = await tool.handler({ id: "ACC-PII-1" });
    const out = JSON.parse(r.content[0]!.text);
    expect(out.id).toBe("ACC-PII-1");
    expect(out.notes).toMatch(/\d{3}-\d{2}-\d{4}/);
  });

  it("returns an error for an unknown id", async () => {
    const { tool } = findTool("getAccount");
    const r = await tool.handler({ id: "ACC-NONE" });
    expect(r.isError).toBe(true);
  });
});

describe("hubspot listContacts", () => {
  it("returns one primary contact per account", async () => {
    const { tool } = findTool("listContacts");
    const r = await tool.handler({ accountId: "ACC-1" });
    const out = JSON.parse(r.content[0]!.text);
    expect(out.contacts).toHaveLength(1);
    expect(out.contacts[0]?.email).toContain("@");
  });
});

describe("hubspot deleteAccount (will-never-automate)", () => {
  it("always returns a forbidden error, records the attempt", async () => {
    const { state, tool } = findTool("deleteAccount");
    const r = await tool.handler({ id: "ACC-1" });
    expect(r.isError).toBe(true);
    const out = JSON.parse(r.content[0]!.text);
    expect(out.code).toBe("forbidden_at_server");
    expect(state.deleteAttempts).toHaveLength(1);
    expect(state.deleteAttempts[0]?.succeeded).toBe(false);
  });

  it("is advertised in the tool surface so Cedar policy 06 has something to deny", () => {
    const names = tools(createState()).map((t) => t.name);
    expect(names).toContain("deleteAccount");
  });
});

describe("PII account presence", () => {
  it("the fixture's PII accounts are all reachable via getAccount", async () => {
    const { tool } = findTool("getAccount");
    for (const id of PII_ACCOUNT_IDS) {
      const r = await tool.handler({ id });
      expect(r.isError).not.toBe(true);
    }
  });
});

describe("hubspot tool scope metadata", () => {
  it("getAccount + listContacts require hubspot:read, deleteAccount requires hubspot:delete", () => {
    const list = tools(createState());
    expect(list.find((t) => t.name === "getAccount")?.requiredScopes).toContain("hubspot:read");
    expect(list.find((t) => t.name === "listContacts")?.requiredScopes).toContain("hubspot:read");
    expect(list.find((t) => t.name === "deleteAccount")?.requiredScopes).toContain(
      "hubspot:delete",
    );
  });
});
