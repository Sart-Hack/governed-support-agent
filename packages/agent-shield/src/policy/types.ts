export type Effect = "permit" | "forbid";
export type Decision = "allow" | "deny";

export interface EntityRef {
  type: string;
  id: string;
}

export interface Entity {
  uid: EntityRef;
  attrs?: Record<string, unknown>;
  parents?: EntityRef[];
}

export interface PolicyAnnotations {
  asi?: string;
  description?: string;
  [key: string]: string | undefined;
}

export interface LoadedPolicy {
  id: string;
  text: string;
  effect: Effect;
  annotations: PolicyAnnotations;
}

export interface PolicyLoadError {
  id: string;
  message: string;
}

export interface PolicyEvaluationRequest {
  principal: EntityRef;
  action: EntityRef;
  resource: EntityRef;
  context?: Record<string, unknown>;
  entities?: Entity[];
}

export interface PolicyReason {
  policyId: string;
  effect: Effect;
  annotations: PolicyAnnotations;
}

export interface PolicyEvaluationError {
  policyId: string;
  message: string;
}

export interface PolicyDecision {
  decision: Decision;
  reasons: PolicyReason[];
  errors: PolicyEvaluationError[];
  request: PolicyEvaluationRequest;
}
