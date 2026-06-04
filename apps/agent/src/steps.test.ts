import { evaluate } from "@sarthak/agent-shield";
import { describe, expect, it } from "vitest";
import { buildShield, toPolicyRequest } from "./governance.js";
import { ScriptedChatModel } from "./llm/scripted.js";
import {
  type AgentDeps,
  type RunState,
  type ToolGateway,
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
});
