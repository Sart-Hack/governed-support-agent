export interface BreakerObservation {
  costUsd?: number;
  toolCall?: { name: string; argsHash: string };
}

export interface BreakerState {
  cumulativeCostUsd: number;
  toolCallCounts: Record<string, number>;
  tripped: boolean;
  reason?: string;
}

export interface CircuitBreaker {
  observe(o: BreakerObservation): BreakerState;
  state(): BreakerState;
  reset(): void;
}

export interface BreakerOptions {
  costCeilingUsd: number;
  duplicateToolCallLimit: number;
}

export function createBreaker(opts: BreakerOptions): CircuitBreaker {
  const state: BreakerState = {
    cumulativeCostUsd: 0,
    toolCallCounts: {},
    tripped: false,
  };

  return {
    observe(o) {
      if (state.tripped) return state;
      if (typeof o.costUsd === "number") {
        state.cumulativeCostUsd += o.costUsd;
        if (state.cumulativeCostUsd >= opts.costCeilingUsd) {
          state.tripped = true;
          state.reason = `cost ceiling $${opts.costCeilingUsd.toFixed(2)} reached (cumulative $${state.cumulativeCostUsd.toFixed(2)})`;
        }
      }
      if (o.toolCall) {
        const key = `${o.toolCall.name}::${o.toolCall.argsHash}`;
        const next = (state.toolCallCounts[key] ?? 0) + 1;
        state.toolCallCounts[key] = next;
        if (!state.tripped && next > opts.duplicateToolCallLimit) {
          state.tripped = true;
          state.reason = `duplicate tool call ${o.toolCall.name} fired ${next} times (limit ${opts.duplicateToolCallLimit})`;
        }
      }
      return state;
    },
    state() {
      return { ...state, toolCallCounts: { ...state.toolCallCounts } };
    },
    reset() {
      state.cumulativeCostUsd = 0;
      state.toolCallCounts = {};
      state.tripped = false;
      state.reason = undefined;
    },
  };
}
