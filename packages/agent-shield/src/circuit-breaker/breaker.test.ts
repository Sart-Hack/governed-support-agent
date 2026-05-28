import { describe, expect, it } from "vitest";
import { createBreaker } from "./index.js";

describe("circuit breaker", () => {
  it("trips on cost ceiling", () => {
    const b = createBreaker({ costCeilingUsd: 0.5, duplicateToolCallLimit: 3 });
    expect(b.observe({ costUsd: 0.2 }).tripped).toBe(false);
    expect(b.observe({ costUsd: 0.2 }).tripped).toBe(false);
    const tripped = b.observe({ costUsd: 0.2 });
    expect(tripped.tripped).toBe(true);
    expect(tripped.reason).toContain("cost ceiling");
  });

  it("trips on duplicate tool calls", () => {
    const b = createBreaker({ costCeilingUsd: 100, duplicateToolCallLimit: 3 });
    const call = { name: "listTickets", argsHash: "abc" };
    b.observe({ toolCall: call });
    b.observe({ toolCall: call });
    b.observe({ toolCall: call });
    const tripped = b.observe({ toolCall: call });
    expect(tripped.tripped).toBe(true);
    expect(tripped.reason).toContain("duplicate tool call");
  });

  it("is idempotent once tripped", () => {
    const b = createBreaker({ costCeilingUsd: 0.5, duplicateToolCallLimit: 3 });
    b.observe({ costUsd: 1.0 });
    const state = b.observe({ costUsd: 1.0 });
    expect(state.tripped).toBe(true);
    expect(state.cumulativeCostUsd).toBe(1.0);
  });

  it("resets cleanly", () => {
    const b = createBreaker({ costCeilingUsd: 0.5, duplicateToolCallLimit: 3 });
    b.observe({ costUsd: 1.0 });
    b.reset();
    expect(b.state().tripped).toBe(false);
    expect(b.state().cumulativeCostUsd).toBe(0);
  });
});
