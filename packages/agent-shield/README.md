# @sarthak/agent-shield

The governance layer for AI agents, extracted as a standalone package: Cedar
policies, an append-only audit log, a kill-switch, an MCP scope check, a circuit
breaker, PII redaction, and an indirect-injection detector. You wrap a workflow
step once, and every tool call it makes is authorized, audited, and bounded.

Built for the [Governed Support Ops Agent](https://github.com/Sart-Hack/governed-support-agent)
demo. Apache-2.0.

## Install

```bash
pnpm add @sarthak/agent-shield
```

## Public API

```ts
import {
  shield,
  loadPolicies,
  InMemoryAuditSink,
  NoopKillSwitch,
  GrantedScopeCheck,
  createBreaker,
} from "@sarthak/agent-shield";

const { policies } = loadPolicies(policyFiles); // .cedar text, in version control
const guard = shield({
  policies,                                   // Cedar policy set
  audit: new InMemoryAuditSink(),             // append-only decision log
  killSwitch: new NoopKillSwitch(),           // operator halt, checked per step
  scopeCheck: new GrantedScopeCheck(scopes),  // least-privilege tool allow-list
  breaker: createBreaker({ costCeilingUsd: 0.5, duplicateToolCallLimit: 3 }),
});

// Wrap any async step. Kill-switch, breaker, and step.start/end audit happen
// around it automatically.
const guarded = guard.wrap(async (state, ctx) => {
  // Authorize a tool call against Cedar before it leaves the process.
  const decision = guard.authorize(request);
  if (decision.decision === "deny") throw new Error(formatDecision(decision).summary);
  // ... dispatch the tool ...
  return state;
});
```

## What it gives you

| Control | Export | Maps to |
|---|---|---|
| Cedar authorization | `shield`, `evaluate`, `loadPolicies` | policy-as-code in version control |
| Human-readable denials | `formatDecision` | reason chains for traces and Slack |
| Append-only audit | `InMemoryAuditSink`, `AuditSink` | every decision recorded |
| Operator halt | `NoopKillSwitch`, `KillSwitch` | ASI08 Operator Control |
| Least-privilege tools | `GrantedScopeCheck`, `ScopeCheck` | ASI02 Tool Misuse |
| Cost / loop bounds | `createBreaker` | ASI09 Cost / Quota |
| PII redaction | `applyResponseTransform`, `redactPii` | ASI04 Data Exfiltration |
| Injection detection | `detectInjection`, `summarizeInjection` | ASI01 Agent Goal Hijack |

The kill-switch and audit sink are interfaces, so you can back them with Postgres,
Redis, or your own store. The demo uses a Postgres-backed kill-switch.

## License

Apache-2.0. See the [LICENSE](./LICENSE) file and the
[repository root](https://github.com/Sart-Hack/governed-support-agent/blob/main/LICENSE).
