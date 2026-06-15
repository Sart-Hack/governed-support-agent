export {
  CircuitBreakerTrippedError,
  KillSwitchTrippedError,
  PolicyDenyError,
  shield,
} from "./shield.js";
export type { Shield, ShieldConfig, ShieldedStep, StepContext } from "./shield.js";

export {
  evaluate,
  formatDecision,
  loadPolicies,
} from "./policy/index.js";
export type {
  Decision,
  Effect,
  Entity,
  EntityRef,
  FormattedDecision,
  LoadedPolicy,
  LoadResult,
  PolicyAnnotations,
  PolicyDecision,
  PolicyEvaluationError,
  PolicyEvaluationRequest,
  PolicyLoadError,
  PolicyReason,
} from "./policy/index.js";

export { InMemoryAuditSink } from "./audit/index.js";
export type { AuditEvent, AuditEventKind, AuditSink } from "./audit/index.js";

export { NoopKillSwitch } from "./kill-switch/index.js";
export type { KillSwitch } from "./kill-switch/index.js";

export { createBreaker } from "./circuit-breaker/index.js";
export type {
  BreakerObservation,
  BreakerOptions,
  BreakerState,
  CircuitBreaker,
} from "./circuit-breaker/index.js";

export {
  AllowAllScopeCheck,
  GrantedScopeCheck,
  REQUIRED_SCOPES_META_KEY,
} from "./scope-check/index.js";
export type { RequiredScope, ScopeCheck } from "./scope-check/index.js";

export { applyResponseTransform, redactPii } from "./transform/index.js";
export type { Redaction, RedactionResult, TransformResult } from "./transform/index.js";
