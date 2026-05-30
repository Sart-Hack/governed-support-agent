import { describe, expect, it } from "vitest";
import { createState, tools } from "./tools.js";

function findTool(name: string) {
  const def = tools(createState()).find((t) => t.name === name);
  if (!def) throw new Error(`tool ${name} missing`);
  return def;
}

describe("zendesk listTickets", () => {
  it("returns all 12 tickets by default", async () => {
    const state = createState();
    const r = await tools(state)
      .find((t) => t.name === "listTickets")!
      .handler({});
    const out = JSON.parse(r.content[0]!.text);
    expect(out).toHaveLength(12);
  });

  it("filters by status", async () => {
    const state = createState();
    const r = await tools(state)
      .find((t) => t.name === "listTickets")!
      .handler({
        status: "new",
      });
    const out = JSON.parse(r.content[0]!.text);
    for (const t of out) expect(t.status).toBe("new");
  });

  it("filters by tenant", async () => {
    const state = createState();
    const r = await tools(state)
      .find((t) => t.name === "listTickets")!
      .handler({
        tenant: "tenant-B",
      });
    const out = JSON.parse(r.content[0]!.text);
    expect(out.every((t: { tenant: string }) => t.tenant === "tenant-B")).toBe(true);
    expect(out).toHaveLength(1);
  });
});

describe("zendesk getTicket", () => {
  it("returns a known ticket", async () => {
    const r = await findTool("getTicket").handler({ id: "TCK-1" });
    const out = JSON.parse(r.content[0]!.text);
    expect(out.id).toBe("TCK-1");
    expect(out.subject).toContain("invoices");
  });

  it("returns an error payload for an unknown id", async () => {
    const r = await findTool("getTicket").handler({ id: "TCK-9999" });
    expect(r.isError).toBe(true);
    const out = JSON.parse(r.content[0]!.text);
    expect(out.error).toContain("not found");
  });
});

describe("zendesk reply tools record events", () => {
  it("replyInternal logs an event but does not change ticket status", async () => {
    const state = createState();
    const def = tools(state).find((t) => t.name === "replyInternal")!;
    await def.handler({ ticketId: "TCK-1", text: "investigating" });
    expect(state.replies).toHaveLength(1);
    expect(state.replies[0]?.kind).toBe("internal");
    expect(state.tickets.get("TCK-1")?.status).toBe("new");
  });

  it("replyPublic logs a public event", async () => {
    const state = createState();
    const def = tools(state).find((t) => t.name === "replyPublic")!;
    await def.handler({ ticketId: "TCK-1", text: "hello customer" });
    expect(state.replies[0]?.kind).toBe("public");
  });
});

describe("zendesk closeTicket", () => {
  it("transitions status to closed and records a state change", async () => {
    const state = createState();
    const def = tools(state).find((t) => t.name === "closeTicket")!;
    await def.handler({ ticketId: "TCK-1" });
    expect(state.tickets.get("TCK-1")?.status).toBe("closed");
    expect(state.stateChanges).toHaveLength(1);
  });
});

describe("zendesk tool scope metadata", () => {
  it("every tool declares its required scopes", () => {
    for (const t of tools(createState())) {
      expect(t.requiredScopes.length).toBeGreaterThan(0);
    }
  });
});
