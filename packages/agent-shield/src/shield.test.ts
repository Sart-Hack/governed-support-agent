import { describe, expect, it } from "vitest";
import { InMemoryAuditSink } from "./audit/index.js";
import { createBreaker } from "./circuit-breaker/index.js";
import { NoopKillSwitch } from "./kill-switch/index.js";
import { loadPolicies } from "./policy/index.js";
import { AllowAllScopeCheck } from "./scope-check/index.js";
import { CircuitBreakerTrippedError, KillSwitchTrippedError, shield } from "./shield.js";

function makeShield() {
  const { policies } = loadPolicies([
    {
      id: "06-delete-account-never",
      text: `@asi("ASI10") forbid ( principal, action in [Action::"deleteAccount"], resource );`,
    },
  ]);
  const audit = new InMemoryAuditSink();
  const killSwitch = new NoopKillSwitch();
  const scopeCheck = new AllowAllScopeCheck();
  const breaker = createBreaker({ costCeilingUsd: 0.5, duplicateToolCallLimit: 3 });
  return { s: shield({ policies, audit, killSwitch, scopeCheck, breaker }), audit, breaker };
}

describe("shield.wrap", () => {
  it("emits step.start + step.end on success", async () => {
    const { s, audit } = makeShield();
    const step = s.wrap<{ n: number }, { doubled: number }>(async (input) => ({
      doubled: input.n * 2,
    }));

    const out = await step({ n: 21 }, { runId: "run-1", stepId: "double" });

    expect(out).toEqual({ doubled: 42 });
    const kinds = audit.list().map((e) => e.kind);
    expect(kinds).toEqual(["step.start", "step.end"]);
  });

  it("emits step.error and rethrows on failure", async () => {
    const { s, audit } = makeShield();
    const step = s.wrap<unknown, unknown>(async () => {
      throw new Error("boom");
    });

    await expect(step({}, { runId: "run-2", stepId: "fail" })).rejects.toThrow("boom");
    const kinds = audit.list().map((e) => e.kind);
    expect(kinds).toEqual(["step.start", "step.error"]);
  });

  it("blocks step when kill-switch is tripped", async () => {
    const { policies } = loadPolicies([]);
    const audit = new InMemoryAuditSink();
    const killSwitch = {
      isTripped: () => true,
      trip: () => {},
      reset: () => {},
    };
    const s = shield({
      policies,
      audit,
      killSwitch,
      scopeCheck: new AllowAllScopeCheck(),
      breaker: createBreaker({ costCeilingUsd: 0.5, duplicateToolCallLimit: 3 }),
    });
    const step = s.wrap(async () => "should not run");
    await expect(step({}, { runId: "r", stepId: "s" })).rejects.toBeInstanceOf(
      KillSwitchTrippedError,
    );
    expect(audit.list().map((e) => e.kind)).toEqual(["kill.triggered"]);
  });

  it("blocks step when breaker is already tripped", async () => {
    const { s, audit, breaker } = makeShield();
    breaker.observe({ costUsd: 1.0 });
    const step = s.wrap(async () => "should not run");
    await expect(step({}, { runId: "r", stepId: "s" })).rejects.toBeInstanceOf(
      CircuitBreakerTrippedError,
    );
    expect(audit.list().map((e) => e.kind)).toEqual(["circuit.tripped"]);
  });
});

describe("shield.authorize", () => {
  it("denies forbidden actions through the shield surface", () => {
    const { s } = makeShield();
    const decision = s.authorize({
      principal: { type: "User", id: "alice" },
      action: { type: "Action", id: "deleteAccount" },
      resource: { type: "Account", id: "ACC-9" },
      entities: [],
    });
    expect(decision.decision).toBe("deny");
    expect(decision.reasons[0]?.policyId).toBe("06-delete-account-never");
  });
});
