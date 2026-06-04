import { TracingAuditSink, initTracing } from "@gsa/tracing";
import { InMemoryAuditSink } from "@sarthak/agent-shield";
import { App, type BlockAction, type ButtonAction } from "@slack/bolt";
import { buildGovernance } from "../governance.js";
import { BifrostChatModel } from "../llm/bifrost.js";
import type { RunState } from "../steps.js";
import { buildSupportOpsWorkflow } from "../workflow.js";
import { defaultApprovalChannel } from "./approval.js";

// Socket Mode listener that turns Slack Approve/Reject clicks into Mastra
// resumes — no public URL needed. Run alongside the agent: `pnpm slack:approvals`.
// Requires SLACK_BOT_TOKEN (xoxb-) and SLACK_APP_TOKEN (xapp-, connections:write).

const botToken = process.env.SLACK_BOT_TOKEN;
const appToken = process.env.SLACK_APP_TOKEN;
if (!botToken || !appToken) {
  console.error(
    "slack:approvals needs SLACK_BOT_TOKEN (xoxb-) and SLACK_APP_TOKEN (xapp-). " +
      "Enable Socket Mode + Interactivity in the Slack app and create an app-level token.",
  );
  process.exit(1);
}

const tracing = initTracing();
const audit = new TracingAuditSink(tracing.tracer, new InMemoryAuditSink());
const gov = await buildGovernance({ audit });
const mastra = buildSupportOpsWorkflow({
  shield: gov.shield,
  gateway: gov.pool,
  llm: new BifrostChatModel(),
  approvalChannel: defaultApprovalChannel(),
});

interface ResumeOutcome {
  ok: boolean;
  state?: RunState;
  error?: string;
}

async function resume(
  runId: string,
  decision: "approved" | "rejected",
  approver: string,
  comment: string | undefined,
): Promise<ResumeOutcome> {
  try {
    const run = await mastra.getWorkflow("supportOps").createRun({ runId });
    const result = await run.resume({
      step: "approval-gate",
      resumeData: { decision, approver, comment },
    });
    if (result.status === "success") return { ok: true, state: result.result as RunState };
    return { ok: false, error: `workflow ${result.status}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function userLabel(u: { id: string; username?: string; name?: string }): string {
  return u.username ?? u.name ?? u.id;
}

function outcomeBlocks(verb: string, approver: string, outcome: ResumeOutcome, comment?: string) {
  const lines: string[] = [`*${verb}* by <@${approver}>`];
  if (comment) lines.push(`Comment: ${comment}`);
  if (outcome.ok) {
    const executed = outcome.state?.execution?.results.map((r) => r.tool).join(", ") || "(none)";
    lines.push(
      `Executed: ${executed}${outcome.state?.execution?.revised ? " (revise branch)" : ""}`,
    );
  } else {
    lines.push(`⚠️ Not completed: ${outcome.error}`);
  }
  return [{ type: "section", text: { type: "mrkdwn", text: lines.join("\n") } }];
}

const app = new App({ token: botToken, appToken, socketMode: true });

app.action("approve", async ({ ack, body, client }) => {
  await ack();
  const action = body as BlockAction;
  const runId = (action.actions[0] as ButtonAction).value;
  if (!runId) return;
  const approver = userLabel(action.user);
  const outcome = await resume(runId, "approved", approver, undefined);
  if (action.channel && action.message) {
    await client.chat.update({
      channel: action.channel.id,
      ts: action.message.ts,
      text: `Approved by ${approver}`,
      blocks: outcomeBlocks("Approved", approver, outcome),
    });
  }
});

app.action("reject", async ({ ack, body, client }) => {
  await ack();
  const action = body as BlockAction;
  const runId = (action.actions[0] as ButtonAction).value;
  if (!runId) return;
  await client.views.open({
    trigger_id: action.trigger_id,
    view: {
      type: "modal",
      callback_id: "reject_modal",
      private_metadata: JSON.stringify({
        runId,
        channel: action.channel?.id,
        ts: action.message?.ts,
      }),
      title: { type: "plain_text", text: "Reject reply" },
      submit: { type: "plain_text", text: "Reject" },
      blocks: [
        {
          type: "input",
          block_id: "comment_block",
          label: { type: "plain_text", text: "Reason (sent back to the agent)" },
          element: { type: "plain_text_input", action_id: "comment", multiline: true },
        },
      ],
    },
  });
});

app.view("reject_modal", async ({ ack, body, view, client }) => {
  await ack();
  const meta = JSON.parse(view.private_metadata) as {
    runId: string;
    channel?: string;
    ts?: string;
  };
  const comment = view.state.values.comment_block?.comment?.value ?? "";
  const approver = userLabel(body.user);
  const outcome = await resume(meta.runId, "rejected", approver, comment);
  if (meta.channel && meta.ts) {
    await client.chat.update({
      channel: meta.channel,
      ts: meta.ts,
      text: `Rejected by ${approver}`,
      blocks: outcomeBlocks("Rejected", approver, outcome, comment),
    });
  }
});

await app.start();
console.log(
  "▸ Slack approval listener running (Socket Mode). Approve/Reject buttons now resume runs.",
);

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    void (async () => {
      await app.stop();
      await gov.close();
      await tracing.shutdown();
      process.exit(0);
    })();
  });
}
