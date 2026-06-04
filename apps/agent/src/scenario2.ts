import { CircuitBreakerTrippedError, InMemoryAuditSink } from "@sarthak/agent-shield";
import { buildShield } from "./governance.js";

// Scenario 2 — cost ceiling fires. Simulates a runaway subgoal loop: each
// iteration books a (simulated) expensive model call, and the circuit breaker
// halts the run the moment cumulative cost crosses the real $0.50 ceiling. No
// live API spend — the breaker logic is real, the per-iteration cost is fed in.

const SIMULATED_COST_PER_ITERATION = 0.06;

async function main(): Promise<void> {
  const runId = "scenario-2";
  const memory = new InMemoryAuditSink();
  const { shield } = buildShield({ audit: memory });

  console.log("\n▸ scenario 2: runaway loop vs. the $0.50 cost ceiling");
  console.log(
    `  (each iteration simulates a $${SIMULATED_COST_PER_ITERATION.toFixed(2)} model call)\n`,
  );

  let completed = 0;
  try {
    for (let i = 1; i <= 100; i++) {
      await shield.wrap(async () => {
        shield.config.breaker.observe({ costUsd: SIMULATED_COST_PER_ITERATION });
        return {};
      })({}, { runId, stepId: `subgoal-${i}` });
      completed = i;
    }
    console.log("loop finished without tripping — unexpected");
    process.exitCode = 1;
  } catch (err) {
    if (!(err instanceof CircuitBreakerTrippedError)) throw err;
    const state = shield.config.breaker.state();
    console.log(`⛔ circuit breaker tripped after ${completed} completed iteration(s)`);
    console.log(`   cumulative cost : $${state.cumulativeCostUsd.toFixed(2)} (ceiling $0.50)`);
    console.log(`   reason          : ${state.reason}`);
    console.log("   tools stopped; the run is halted before the next step.\n");
  }

  const tripped = memory.list().filter((e) => e.kind === "circuit.tripped").length;
  console.log(
    `audit: ${tripped} circuit.tripped event recorded. "$437 overnight loop" does not happen.`,
  );
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (err) => {
    console.error("scenario2 error:", err);
    process.exit(1);
  },
);
