// Slack Block Kit builder for the approval request. Kept as a pure function so
// the same blocks render in Slack, in the console stand-in, and (later) in the
// microsite's SlackBlockKitRenderer.

export interface ApprovalRequest {
  runId: string;
  ticketId: string;
  /** Short label of the gated action, e.g. "replyPublic on TCK-3". */
  toolSummary: string;
  /** The proposed customer-facing text awaiting approval. */
  draft: string;
  /** Why approval is required (the Cedar reason chain summary). */
  reason: string;
}

export interface SlackMessage {
  text: string;
  blocks: unknown[];
}

export function buildApprovalMessage(req: ApprovalRequest): SlackMessage {
  return {
    text: `Approval needed: ${req.toolSummary} (ticket ${req.ticketId})`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Customer-facing action needs approval" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Ticket:*\n${req.ticketId}` },
          { type: "mrkdwn", text: `*Action:*\n${req.toolSummary}` },
        ],
      },
      { type: "section", text: { type: "mrkdwn", text: `*Draft:*\n>${req.draft || "(empty)"}` } },
      { type: "context", elements: [{ type: "mrkdwn", text: `Gated by: ${req.reason}` }] },
      {
        type: "actions",
        block_id: `approval:${req.runId}`,
        elements: [
          {
            type: "button",
            style: "primary",
            text: { type: "plain_text", text: "Approve" },
            action_id: "approve",
            value: req.runId,
          },
          {
            type: "button",
            style: "danger",
            text: { type: "plain_text", text: "Reject" },
            action_id: "reject",
            value: req.runId,
          },
        ],
      },
    ],
  };
}
