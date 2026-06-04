import { describe, expect, it } from "vitest";
import { ConsoleApprovalChannel, defaultApprovalChannel } from "./approval.js";
import { buildApprovalMessage } from "./blocks.js";

describe("buildApprovalMessage", () => {
  const msg = buildApprovalMessage({
    runId: "r1",
    ticketId: "TCK-3",
    toolSummary: "replyPublic on TCK-3",
    draft: "We have fixed the 500.",
    reason: "Denied by policy 05-customer-facing-requires-approval",
  });

  it("summarizes the gated action in the fallback text", () => {
    expect(msg.text).toContain("replyPublic on TCK-3");
  });

  it("carries Approve and Reject buttons keyed to the run", () => {
    const actions = msg.blocks.find(
      (b): b is { type: string; elements: { action_id: string; value: string }[] } =>
        (b as { type?: string }).type === "actions",
    );
    expect(actions?.elements.map((e) => e.action_id)).toEqual(["approve", "reject"]);
    expect(actions?.elements.every((e) => e.value === "r1")).toBe(true);
  });
});

describe("defaultApprovalChannel", () => {
  it("falls back to the console stand-in when Slack env is absent", () => {
    expect(defaultApprovalChannel({} as NodeJS.ProcessEnv)).toBeInstanceOf(ConsoleApprovalChannel);
  });

  it("uses Slack when a bot token and channel are set", () => {
    const ch = defaultApprovalChannel({
      SLACK_BOT_TOKEN: "xoxb-test",
      SLACK_APPROVAL_CHANNEL: "C123",
    } as unknown as NodeJS.ProcessEnv);
    expect(ch.kind).toBe("slack");
  });
});
