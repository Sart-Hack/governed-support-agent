import { evaluate } from "@sarthak/agent-shield";
import { describe, expect, it } from "vitest";
import { buildShield, toPolicyRequest } from "./governance.js";
import { ScriptedChatModel } from "./llm/scripted.js";
import {
  type AgentDeps,
  type RunState,
  type ToolGateway,
  executeStep,
  policyCheckStep,
  runSupportOps,
} from "./steps.js";

// A gateway that echoes calls back as success; scope-checking is exercised in
// @gsa/mcp-client's own tests, so here we focus on Cedar policy gating.
function stubGateway(): ToolGateway & { calls: { server: string; tool: string }[] } {
  const calls: { server: string; tool: string }[] = [];
  return {
    calls,
    async callTool(server, tool, args) {
      calls.push({ server, tool });
      return {
        content: [{ type: "text", text: JSON.stringify({ server, tool, args }) }],
        isError: false,
        data: { server, tool, args },
      };
    },
    async listAllTools() {
      return {};
    },
  };
}

function deps(model: ScriptedChatModel): AgentDeps & { gateway: ReturnType<typeof stubGateway> } {
  const gateway = stubGateway();
  const { shield } = buildShield();
  return { shield, gateway, llm: model };
}

const ctx = { runId: "test", stepId: "test" };

describe("support-ops happy path (scenario 1)", () => {
  it("classifies, plans an internal note, allows it, and executes", async () => {
    const model = new ScriptedChatModel([
      {
        content:
          '{"category":"billing","customerFacing":false,"summary":"invoice export question"}',
      },
      {
        toolCalls: [
          {
            id: "c1",
            name: "replyInternal",
            args: { text: "Point them to the billing export tab." },
          },
        ],
      },
    ]);
    const d = deps(model);
    const out = await runSupportOps(d, { runId: "r1", ticketId: "TCK-1" });

    expect(out.classification?.category).toBe("billing");
    expect(out.plan?.actions.map((a) => a.tool)).toEqual(["replyInternal"]);
    expect(out.policy?.judgements[0]?.disposition).toBe("allow");
    expect(out.policy?.refused).toBe(false);
    expect(out.approval?.state).toBe("not-required");
    expect(out.execution?.results).toEqual([{ tool: "replyInternal", ok: true }]);
    // getTicket (ingest) + search (triage) + replyInternal (execute) all dispatched.
    expect(d.gateway.calls.map((c) => c.tool)).toEqual(["getTicket", "search", "replyInternal"]);
  });
});

describe("support-ops approval routing", () => {
  it("routes a customer-facing reply to approval and does not execute it unapproved", async () => {
    const model = new ScriptedChatModel([
      { content: '{"category":"billing","customerFacing":true,"summary":"refund request"}' },
      { toolCalls: [{ id: "c1", name: "replyPublic", args: { text: "We will refund you." } }] },
    ]);
    const d = deps(model);
    const out = await runSupportOps(d, { runId: "r2", ticketId: "TCK-1" });

    expect(out.policy?.judgements[0]?.disposition).toBe("needs-approval");
    expect(out.approval?.state).toBe("required");
    expect(out.execution?.results).toEqual([]);
    expect(d.gateway.calls.some((c) => c.tool === "replyPublic")).toBe(false);
  });
});

describe("support-ops refusal", () => {
  it("refuses a hard-forbidden action and executes nothing", async () => {
    const model = new ScriptedChatModel([]);
    const d = deps(model);
    const state: RunState = {
      runId: "r3",
      ticketId: "TCK-1",
      plan: {
        summary: "delete the account",
        actions: [
          {
            server: "hubspot",
            tool: "deleteAccount",
            args: { accountId: "ACC-9" },
            customerFacing: false,
          },
        ],
      },
    };
    const checked = await d.shield.wrap(policyCheckStep(d))(state, ctx);
    expect(checked.policy?.refused).toBe(true);
    expect(checked.policy?.judgements[0]?.disposition).toBe("refuse");
    expect(checked.policy?.judgements[0]?.asiIds.some((a) => a.includes("ASI10"))).toBe(true);
  });
});

describe("support-ops reject → revise branch (scenario 3)", () => {
  it("does not send the customer reply on rejection and leaves an internal revise note", async () => {
    const d = deps(new ScriptedChatModel([]));
    const state: RunState = {
      runId: "r4",
      ticketId: "TCK-3",
      plan: {
        summary: "reply to customer",
        actions: [
          {
            server: "zendesk",
            tool: "replyPublic",
            args: { ticketId: "TCK-3", text: "fixed" },
            customerFacing: true,
          },
        ],
      },
      policy: {
        judgements: [
          {
            tool: "replyPublic",
            disposition: "needs-approval",
            reason: "policy 05",
            asiIds: ["ASI03"],
          },
        ],
        refused: false,
      },
      approval: { state: "rejected" },
    };
    const out = await d.shield.wrap(executeStep(d))(state, ctx);
    expect(out.execution?.revised).toBe(true);
    expect(out.execution?.results.map((r) => r.tool)).toEqual(["replyInternal"]);
    expect(d.gateway.calls.map((c) => c.tool)).toEqual(["replyInternal"]);
  });
});

describe("support-ops files a github issue", () => {
  it("routes createIssue to the github server, which policy 04 (Engineer) allows", async () => {
    const model = new ScriptedChatModel([
      { content: '{"category":"bug","customerFacing":false,"summary":"500 on /v2/users"}' },
      {
        toolCalls: [
          { id: "c1", name: "createIssue", args: { title: "500 on /v2/users", severity: "P2" } },
        ],
      },
    ]);
    const d = deps(model);
    const out = await runSupportOps(d, { runId: "r5", ticketId: "TCK-3" });

    expect(out.plan?.actions[0]?.server).toBe("github");
    expect(out.policy?.judgements[0]?.disposition).toBe("allow");
    expect(out.execution?.results.map((r) => r.tool)).toEqual(["createIssue"]);
    expect(d.gateway.calls.some((c) => c.server === "github" && c.tool === "createIssue")).toBe(
      true,
    );
  });
});

describe("toPolicyRequest mapping", () => {
  const { shield } = buildShield();
  const policies = shield.config.policies;

  it("allows a SupportLead internal reply on a same-tenant ticket", () => {
    const req = toPolicyRequest("zendesk", "replyInternal", { ticketId: "TCK-1", text: "x" });
    expect(evaluate(policies, req).decision).toBe("allow");
  });

  it("allows a support-kb notion search", () => {
    const req = toPolicyRequest("notion", "search", { query: "billing", tag: "support-kb" });
    expect(evaluate(policies, req).decision).toBe("allow");
  });

  it("denies a hubspot delete unconditionally", () => {
    const req = toPolicyRequest("hubspot", "deleteAccount", { accountId: "ACC-9" });
    expect(evaluate(policies, req).decision).toBe("deny");
  });

  it("denies a customer-facing reply with no approval recorded", () => {
    const req = toPolicyRequest("zendesk", "replyPublic", { ticketId: "TCK-1", text: "x" });
    expect(evaluate(policies, req).decision).toBe("deny");
  });

  it("allows createIssue on the support repo (Engineer role, non-P0)", () => {
    const req = toPolicyRequest("github", "createIssue", { title: "bug", severity: "P2" });
    expect(evaluate(policies, req).decision).toBe("allow");
  });
});
