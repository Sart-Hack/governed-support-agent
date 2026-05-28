# Threat Model

How the Governed Support Ops Agent maps to the **OWASP Top 10 for Agentic Applications (ASI01–ASI10, December 2025)**. Every Cedar policy in [`packages/policies/`](./packages/policies/policies/) is mapped to its primary ASI ID below; every ASI ID is either covered by a policy, by a runtime control (kill-switch, circuit breaker), or has an honest gap noted.

References:
- OWASP Agentic AI Top 10 — https://genai.owasp.org/llm-top-10/
- Policies as source of truth — [`packages/policies/policies/*.cedar`](./packages/policies/policies/)
- Runtime controls — `packages/agent-shield/src/{kill-switch,circuit-breaker}/`

## Coverage matrix

| ASI ID | Name | Mitigation | Where |
|---|---|---|---|
| ASI01 | Agent Goal Hijack | Notion reads restricted to `public` and `support-kb` tags — limits indirect-injection surface from KB poisoning | [`02-notion-tag-filtered.cedar`](./packages/policies/policies/02-notion-tag-filtered.cedar) |
| ASI02 | Tool Misuse | Zendesk reads bound to `SupportLead`; GitHub writes bound to `Engineer` + non-P0 + `support` repo | [`01-zendesk-read-only.cedar`](./packages/policies/policies/01-zendesk-read-only.cedar), [`04-github-write-scoped.cedar`](./packages/policies/policies/04-github-write-scoped.cedar) |
| ASI03 | Delegated Trust | Customer-facing actions (`replyPublic`, `sendEmail`) forbidden unless `context.humanApprovalState == "approved"` | [`05-customer-facing-requires-approval.cedar`](./packages/policies/policies/05-customer-facing-requires-approval.cedar) |
| ASI04 | Data Exfiltration | HubSpot reads only when `context.responseTransform == "pii-redact"` — agent-shield applies the redaction transform | [`03-hubspot-pii-redacted.cedar`](./packages/policies/policies/03-hubspot-pii-redacted.cedar) |
| ASI05 | Privilege Escalation | Implicit — Cedar's principal-bound role check on every policy + default-deny when no permit matches. No dedicated policy yet. | implicit (all policies) |
| ASI06 | Inter-Agent / Cross-Boundary | Cross-tenant access forbidden when `principal.tenant != resource.tenant` | [`07-tenant-isolation.cedar`](./packages/policies/policies/07-tenant-isolation.cedar) |
| ASI07 | Memory Leakage | Partially — same redaction transform as ASI04. PII redaction prevents leakage into LLM short-term memory. | [`03-hubspot-pii-redacted.cedar`](./packages/policies/policies/03-hubspot-pii-redacted.cedar) |
| ASI08 | Operator Control | Kill-switch: Postgres-backed flag polled per workflow step; in-flight runs suspend gracefully and audit-log the halt | `packages/agent-shield/src/kill-switch/` (full impl: P2-M9) |
| ASI09 | Cost / Quota | Circuit breaker: $0.50 cumulative LLM cost ceiling per run + duplicate-tool-call detector (>3 identical calls). Trips loud, halts run. | `packages/agent-shield/src/circuit-breaker/` |
| ASI10 | Rogue Agents | Hard-forbid on destructive deletion of customer records — `hubspot:deleteAccount` and `zendesk:deleteUser` denied unconditionally | [`06-delete-account-never.cedar`](./packages/policies/policies/06-delete-account-never.cedar) |

## Policies → ASI quick view

| Policy | Effect | ASI |
|---|---|---|
| `01-zendesk-read-only` | permit | ASI02 |
| `02-notion-tag-filtered` | permit | ASI01 |
| `03-hubspot-pii-redacted` | permit | ASI04 (+ ASI07 partial) |
| `04-github-write-scoped` | permit | ASI02 |
| `05-customer-facing-requires-approval` | forbid | ASI03 |
| `06-delete-account-never` | forbid | ASI10 |
| `07-tenant-isolation` | forbid | ASI06 |

## Gaps (honest)

- **ASI05 Privilege Escalation** — no dedicated policy. Mitigated implicitly by default-deny + role-scoped permits; a dedicated policy would explicitly forbid role-change actions. Backlog.
- **ASI07 Memory Leakage** — only partially mitigated by the redaction transform. A full mitigation needs a turn-level memory scrubber, which is out of scope for the demo.
- **Indirect injection beyond Notion** — only KB content is filtered. Tickets themselves can carry injection payloads; that risk is bounded by Cedar denying all customer-facing actions without approval (ASI03), but the agent will still *read* the injection text.

## Demo scenarios that exercise this model

| Scenario | ASI exercised | Policy invoked | Outcome |
|---|---|---|---|
| 1. Happy path | — | 01, 04 | allow |
| 2. Cost ceiling fires | ASI09 | n/a (circuit breaker) | run halts mid-flight |
| 3. Human rejects | ASI03 | 05 | suspended → resumed into revise branch |
| 4. PII redaction | ASI04 / ASI07 | 03 | un-redacted variant denied; redacted variant allowed |
| 5. Refusal: delete account | ASI10 | 06 | denied with reason chain |
| 6. Refusal: indirect injection from Notion | ASI01 | 02 | injection-bearing page is unreachable; agent's plan to act on it is also blocked |
| 7. Kill switch | ASI08 | n/a (kill-switch) | in-flight run halts within 1s |
| 8. Cross-tenant access denied *(conditional)* | ASI06 | 07 | tenant-A principal denied on tenant-B resource |

## Verification

- Policy parse + ASI-annotation presence + behavioral assertions for each policy → [`packages/policies/src/policies.test.ts`](./packages/policies/src/policies.test.ts) (24 tests).
- Custom-eval suite (P2-M11+ / Phase 3) adds OWASP-ASI-mapped assertions: one assertion per ASI ID, mapped to a scenario or policy. Target: 10/10 ASI assertions pass.
