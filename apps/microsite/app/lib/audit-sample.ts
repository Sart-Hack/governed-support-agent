// A compact, pre-captured slice of the agent's audit-event stream, used by the
// persistent top-of-page audit strip. The deployed demo never calls a live LLM,
// so this is a recorded run (scenario 1, ticket TCK-1) plus one refusal event to
// show the deny path. Shapes mirror the real audit kinds the agent emits.

export type AuditTone = "info" | "success" | "danger" | "policy" | "approval";

export type AuditEvent = {
  time: string;
  source: string;
  kind: string;
  detail: string;
  tone: AuditTone;
};

export const TONE_DOT: Record<AuditTone, string> = {
  info: "bg-info",
  success: "bg-success",
  danger: "bg-danger",
  policy: "bg-policy",
  approval: "bg-approval",
};

export const AUDIT_SAMPLE: AuditEvent[] = [
  {
    time: "14:02:31",
    source: "ingest",
    kind: "step.start",
    detail: "classify ticket TCK-1",
    tone: "info",
  },
  {
    time: "14:02:31",
    source: "zendesk",
    kind: "scope.granted",
    detail: "getTicket",
    tone: "success",
  },
  {
    time: "14:02:31",
    source: "zendesk",
    kind: "tool.call",
    detail: "getTicket(TCK-1)",
    tone: "info",
  },
  {
    time: "14:02:32",
    source: "ingest",
    kind: "llm.completion",
    detail: "gpt-4o-mini · 412 tokens",
    tone: "info",
  },
  {
    time: "14:02:33",
    source: "triage",
    kind: "policy.decision",
    detail: "search → allow · policy 02",
    tone: "policy",
  },
  {
    time: "14:02:33",
    source: "notion",
    kind: "tool.call",
    detail: "search(support-kb)",
    tone: "info",
  },
  {
    time: "14:02:34",
    source: "policy-check",
    kind: "policy.decision",
    detail: "replyInternal → allow · policy 01",
    tone: "policy",
  },
  {
    time: "14:02:34",
    source: "zendesk",
    kind: "tool.call",
    detail: "replyInternal(TCK-1)",
    tone: "info",
  },
  {
    time: "14:02:35",
    source: "execute",
    kind: "tool.result",
    detail: "replyInternal ok",
    tone: "success",
  },
  {
    time: "14:02:35",
    source: "audit",
    kind: "run.summary",
    detail: "1 action executed · 0 refused",
    tone: "success",
  },
  {
    time: "14:05:10",
    source: "execute",
    kind: "policy.decision",
    detail: "deleteAccount → DENY · policy 06",
    tone: "danger",
  },
];
