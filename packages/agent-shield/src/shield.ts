import type { AuditEvent, AuditSink } from "./audit/index.js";
import type { CircuitBreaker } from "./circuit-breaker/index.js";
import type { KillSwitch } from "./kill-switch/index.js";
import { evaluate } from "./policy/evaluator.js";
import { formatDecision } from "./policy/format-decision.js";
import type { LoadedPolicy, PolicyDecision, PolicyEvaluationRequest } from "./policy/types.js";
import type { ScopeCheck } from "./scope-check/index.js";

export interface ShieldConfig {
  policies: LoadedPolicy[];
  audit: AuditSink;
  killSwitch: KillSwitch;
  scopeCheck: ScopeCheck;
  breaker: CircuitBreaker;
}

export interface StepContext {
  runId: string;
  stepId: string;
}

export type ShieldedStep<I, O> = (input: I, ctx: StepContext) => Promise<O>;

export class PolicyDenyError extends Error {
  readonly decision: PolicyDecision;
  constructor(decision: PolicyDecision) {
    super(formatDecision(decision).summary);
    this.name = "PolicyDenyError";
    this.decision = decision;
  }
}

export class KillSwitchTrippedError extends Error {
  constructor(reason: string) {
    super(`kill-switch tripped: ${reason}`);
    this.name = "KillSwitchTrippedError";
  }
}

export class CircuitBreakerTrippedError extends Error {
  constructor(reason: string) {
    super(`circuit breaker tripped: ${reason}`);
    this.name = "CircuitBreakerTrippedError";
  }
}

export interface Shield {
  wrap<I, O>(stepFn: (input: I, ctx: StepContext) => Promise<O>): ShieldedStep<I, O>;
  authorize(request: PolicyEvaluationRequest): PolicyDecision;
  audit(event: AuditEvent): void;
  config: ShieldConfig;
}

export function shield(config: ShieldConfig): Shield {
  // append() may be sync or return a Promise; void swallows both. We do not await
  // it — auditing must never block or fail a step.
  const append = (event: AuditEvent): void => {
    void config.audit.append(event);
  };

  const authorize = (request: PolicyEvaluationRequest): PolicyDecision =>
    evaluate(config.policies, request);

  const wrap = <I, O>(stepFn: (input: I, ctx: StepContext) => Promise<O>): ShieldedStep<I, O> => {
    return async (input, ctx) => {
      const log = (kind: AuditEvent["kind"], payload: AuditEvent["payload"]): void =>
        append({
          ts: new Date().toISOString(),
          runId: ctx.runId,
          stepId: ctx.stepId,
          kind,
          payload,
        });

      if (await config.killSwitch.isTripped()) {
        const reason = "kill-switch active before step";
        log("kill.triggered", { reason });
        throw new KillSwitchTrippedError(reason);
      }

      const breakerBefore = config.breaker.state();
      if (breakerBefore.tripped) {
        log("circuit.tripped", { reason: breakerBefore.reason });
        throw new CircuitBreakerTrippedError(breakerBefore.reason ?? "unknown");
      }

      log("step.start", { input });

      try {
        const output = await stepFn(input, ctx);
        log("step.end", { output });
        return output;
      } catch (err) {
        log("step.error", { name: (err as Error).name, message: (err as Error).message });
        throw err;
      }
    };
  };

  return {
    wrap,
    authorize,
    audit: append,
    config,
  };
}
