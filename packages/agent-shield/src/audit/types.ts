import type { PolicyDecision } from "../policy/types.js";

export type AuditEventKind =
  | "step.start"
  | "step.end"
  | "step.error"
  | "policy.decision"
  | "policy.transform"
  | "tool.call"
  | "tool.result"
  | "scope.granted"
  | "scope.denied"
  | "llm.completion"
  | "approval.requested"
  | "approval.resolved"
  | "kill.triggered"
  | "circuit.tripped"
  | "injection.detected"
  | "run.summary";

export interface AuditEvent {
  ts: string;
  runId: string;
  stepId?: string;
  kind: AuditEventKind;
  payload: Record<string, unknown>;
  decision?: PolicyDecision;
}

export interface AuditSink {
  append(event: AuditEvent): Promise<void> | void;
}
