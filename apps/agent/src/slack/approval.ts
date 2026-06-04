import { type ApprovalRequest, buildApprovalMessage } from "./blocks.js";

export interface ApprovalChannel {
  readonly kind: string;
  /** Post the approval request to wherever a human will see it. */
  request(req: ApprovalRequest): Promise<void>;
}

/**
 * The creds-optional stand-in: prints the approval request and the exact command
 * to resume the suspended run. Stands in for Slack's interactive callback so the
 * suspend/resume path is fully exercisable without a Slack workspace.
 */
export class ConsoleApprovalChannel implements ApprovalChannel {
  readonly kind = "console";

  async request(req: ApprovalRequest): Promise<void> {
    const { text } = buildApprovalMessage(req);
    console.log(`\n[approval] ${text}`);
    console.log(`[approval] draft: ${req.draft || "(empty)"}`);
    console.log(`[approval] gated by: ${req.reason}`);
    console.log(
      `[approval] resume: pnpm --filter @gsa/agent scenario:resume ${req.runId} <approve|reject> "comment"\n`,
    );
  }
}

/** Posts a Block Kit message to a Slack channel via the bot token. */
export class SlackApprovalChannel implements ApprovalChannel {
  readonly kind = "slack";

  constructor(
    private readonly token: string,
    private readonly channel: string,
  ) {}

  async request(req: ApprovalRequest): Promise<void> {
    const { text, blocks } = buildApprovalMessage(req);
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ channel: this.channel, text, blocks }),
    });
    const body = (await res.json()) as { ok: boolean; error?: string };
    if (!body.ok) throw new Error(`slack chat.postMessage failed: ${body.error}`);
  }
}

/** Real Slack when SLACK_BOT_TOKEN + SLACK_APPROVAL_CHANNEL are set, else console. */
export function defaultApprovalChannel(env: NodeJS.ProcessEnv = process.env): ApprovalChannel {
  const token = env.SLACK_BOT_TOKEN;
  const channel = env.SLACK_APPROVAL_CHANNEL;
  if (token && channel) return new SlackApprovalChannel(token, channel);
  return new ConsoleApprovalChannel();
}
