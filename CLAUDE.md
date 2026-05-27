# CLAUDE.md — Governed Support Ops Agent

This file orients a new Claude Code session. **The full source of truth is [`BUILD-SPEC.md`](./BUILD-SPEC.md)** — read it end-to-end before writing code.

## What this repo is

The public demo for Sarthak's solo AI consulting practice. Wedge: "AI agents your security team will actually approve, for US tech companies past Series A." Buyer audience: CTOs / VP Eng at Series B-D US tech (Tailscale, PostHog, Alpaca, Function Health, Pave caliber).

**Two visible artifacts in this monorepo:**
1. **Governed Support Ops Agent** — runnable end-to-end demo: watches a simulated Zendesk queue, reads Notion docs, checks HubSpot, files GitHub issues, posts Slack updates, requires human approval before customer-facing actions.
2. **`@sarthak/agent-shield`** — extracted governance layer (Cedar policies + audit log + kill-switch + MCP scope check + circuit breaker). Pitched on a dedicated `/shield` microsite page. Public API: `shield({ policies, audit, killSwitch, scopeCheck, breaker }).wrap(workflow)`.

## Source of truth

- **`BUILD-SPEC.md`** in this repo — architecture, repo layout, scenarios, hour budget, risks, cut list, verification.
- **External read-only references** at `/Users/sarthak/Desktop/Projects/ai-consulting/`:
  - `strategy.md` — wedge, ICPs, §9b locks the demo scenario domain
  - `trust-system.md` — §1 will-not-automate list, §6 reference architecture
  - `README.md` — project state
  - `site-rewrite-brief.md` — aesthetic alignment (Vercel/Geist, Langfuse dashboard, Linear)

Treat all four as read-only context. Do not modify.

## Locked decisions (do not relitigate)

Debated and locked 2026-05-27. See BUILD-SPEC.md "Decisions (locked)" section.

1. **LLM gateway: Bifrost** (Apache 2.0, Maxim AI). Not Portkey (PANW-acquired April 2026), not LiteLLM (March 2026 PyPI compromise).
2. **Calendar: 6-9 weeks** at 20-25h/wk. Slip launch rather than ship thin.
3. **Scenarios: 7 core + 1 conditional** (#8 cross-tenant). Scenario 8 is first to cut if calendar slips.
4. **Real-API MCP: GitHub Issues** (free-tier OAuth). Not Linear.
5. **Mastra workflow API: v2** (not `workflows-legacy`).
6. **Public eval suite: InjecAgent + custom + OWASP-ASI assertions**. AgentDojo deferred to v2 backlog.

## Hard constraints (will never automate)

From `trust-system.md` §1 and Cedar policy 06:
- `hubspot:deleteAccount` — hard forbidden
- `zendesk:deleteUser` — hard forbidden
- Customer-facing actions without human approval — Cedar policy 05 denies unless `context.humanApprovalState == "approved"`

Non-negotiable. If a future requirement seems to need bypassing these, raise it for discussion — don't silently allow.

## Phase 1 status — complete (2026-05-27)

Foundation shipped, all per-milestone verification gates green, CI green on GitHub. 7 commits on `origin/main`. See [README.md](./README.md#status) for the milestone table.

What's runnable now:
- `pnpm --filter @gsa/microsite dev` → microsite hero on http://localhost:3000
- `pnpm --filter @gsa/agent dev` → CLI prints the ready string
- `pnpm stack:up` + `pnpm stack:verify` → Langfuse v3.175 on :3001, Bifrost on :8080, MinIO console on :9091, postgres on :5432 (incl. pre-created `mastra` DB for HITL), clickhouse, redis

What's not yet (Phase 2-3 work): Cedar policies, MCP servers, Mastra workflow, `agent-shield` package, microsite pages beyond `/`, real Langfuse traces.

Non-BUILD-SPEC choices locked during Phase 1 (don't relitigate):
- **Linter:** Biome 1.9 (single binary, fast)
- **Test runner:** Vitest 2.1 workspace mode
- **Tailwind:** v4 (`4.1.11` — 4.0.0 had a scanner version mismatch)
- **Postgres serves double duty:** Langfuse metadata + Mastra HITL checkpoints (separate logical DBs)
- **Healthcheck quirks** worth remembering: Bifrost needs GET not HEAD, langfuse-web inside-container must use `$HOSTNAME` not `localhost`, MinIO has curl not wget

## Phase-2-hour-1 spikes (next session starts here)

Before any deep agent-core work, two risks from BUILD-SPEC risk register need de-risking:

1. **Mastra v2 `.suspend/.resume` against Postgres** (risk #1). Single workflow, single suspend, `docker compose restart postgres`, confirm `.resume()` works. Connection: `postgresql://postgres:postgres@localhost:5432/mastra` (`MASTRA_DATABASE_URL` in `.env`). Fallback if broken: hand-rolled checkpoint table with explicit pause/resume HTTP endpoints.
2. **Bifrost in front of three MCP mocks** (risk #8). Confirm code-mode token compression works across multi-MCP. Bifrost is on :8080 with empty providers — Phase 2 wires the providers via `infra/bifrost/config.json` + env-var key references. Fallback if broken: direct MCP client without gateway (loses code-mode, preserves demo).

Document spike outcomes in `ARCHITECTURE.md` once that file lands.

## Cut list discipline

Hour-60 MVD is the slip-floor, **not** the target. Cut order (BUILD-SPEC.md "Cuts From Full Plan If Hour Pressure"):
1. AgentDojo (already dropped)
2. Scenario 8 (cross-tenant scripted scene)
3. GitHub real-API MCP → revert to mock
4. Kill-switch + PII-redaction scenarios
5. `/tenants` page
6. Cost overlay on `/traces`
7. Excalidraw, permission matrix interactivity, Monaco editor, Loom, auto-eval-badge

Weekly check-ins at hour 20/40/60/80 against the cut list.

**Non-negotiable floor:**
- Refusal scenario end-to-end with real Cedar deny + human-readable reason chain via `formatDecision()`
- Audit log strip on every microsite page
- Hand-authored SVG architecture diagram
- Cedar policies real and enforced (4+ minimum)
- MCP servers full 2025-11-25 spec-compliant
- `agent-shield` package extracted with clean public API
- Clone-and-run works on Apple Silicon AND x86 Linux
- README is a designed document
- SECURITY.md, LICENSE (Apache 2.0), CONTRIBUTING.md, CODE_OF_CONDUCT.md present

If any of these can't ship, slip launch.

## Conventions

- **License:** Apache 2.0 (matches Cedar, Bifrost, Mastra). Per-package LICENSE references repo root.
- **MCP spec version:** 2025-11-25. Use spec-native `WWW-Authenticate` + step-up auth (SEP-2350) for scope discovery. NOT a custom `x-required-scopes` extension.
- **OTel GenAI semconv:** pin `gen_ai.request.*`, `gen_ai.usage.*`, `gen_ai.response.*` (stable). Agent-span attributes (`gen_ai.agent.*`) still moving — use `OTEL_SEMCONV_STABILITY_OPT_IN` for dual emission. Langfuse v3 (≥3.95) speaks the conventions.
- **Cedar policies map to OWASP Agentic Top 10 (ASI) IDs.** Every policy in `packages/policies/` has a named ASI mapping (ASI01..ASI10) documented in `THREAT-MODEL.md`. Don't use generic "OWASP Agentic" references.
- **Cedar reason chains:** raw chains are verbose. Always wrap with `formatDecision()` (in agent-shield) for trace viewer, `/refusals`, and Slack messages.
- **Mastra:** v2 imports only. Never import from `workflows-legacy`.
- **Postgres for HITL state:** real instance, not in-memory. Survives `docker compose restart`.
- **Microsite imports the exact Cedar files the agent enforces.** Policies shown on `/policies` ARE the policies that run. Same for permission matrix and architecture references.

## Copy guide (microsite + README + docs)

Run this grep before publishing any copy:
- No em dashes — use commas, colons, or two sentences
- No "crucially"
- No "delve"
- No "robust"
- No "seamless"
- No hedge-disclaimers ("Note: this is just a demo...")
- Copy-paste blocks: fenced code, not blockquotes

## Anti-patterns specific to this project

These were considered and rejected. Don't suggest them:
- **LiteLLM** — March 2026 PyPI supply-chain attack. `SECURITY.md` should explicitly note non-use.
- **Portkey** — PANW-acquired April 2026, OSS roadmap uncertain.
- **OPA via HTTP sidecar** — dilutes the "embedded Cedar policies in version control" message.
- **Mastra `workflows-legacy`** — different suspend semantics, deprecated path.
- **AgentDojo** — API instability, deferred to v2 backlog.
- **Live LLM calls in the deployed demo** — credibility liability. Use rrweb recordings of pre-captured runs.
- **Mocking the Postgres checkpoint store** — must be real to prove durability across restarts.
- **Mocking the GitHub integration** — the *one* real-API integration is the signal that "this actually runs against your stuff." Reverting it to a mock is on the cut list, not the default plan.
- **Linear or Jira** instead of GitHub — pattern recognition for the buyer audience wins.
- **In-memory state for HITL** — defeats the suspend/resume durability story.

## Commands (will exist once scaffold lands)

```bash
pnpm install
docker-compose up               # Langfuse + Postgres + Bifrost + MCP mocks
pnpm dev                        # microsite + agent in watch mode
pnpm demo                       # play scenario 1 end-to-end
pnpm eval                       # InjecAgent + custom + OWASP-ASI assertions
pnpm record-scenarios           # regenerate rrweb recordings via Playwright
pnpm lint && pnpm typecheck     # CI parity
```

## Verification gate ("done" means all of these simultaneously)

Per BUILD-SPEC.md "Verification" section:
1. **Functional:** `pnpm demo` plays all 7 core scenarios end-to-end (plus scenario 8 if shipped). Postgres checkpoint survives `docker compose restart` between approval-gate and execute. Slack approval round-trips. Cedar denies refusal cases via `agent-shield`. Circuit breaker trips on $0.50 ceiling. Kill switch halts in-flight run within 1s. GitHub Issue filed against the demo org.
2. **Observability:** Langfuse shows full trace tree per scenario with pinned semconv attributes on every LLM span and `agent.policy.decision.reasons` on every tool span.
3. **Eval gates:** custom ≥90%, InjecAgent ≥80%, 10/10 OWASP-ASI assertions. Badge JSON renders correctly via shields.io.
4. **Microsite:** every page renders. TraceViewer plays scenario 1 with cost overlay. RefusalsPanel plays all refusal recordings. PolicyEditor highlights Cedar grammar. `/shield`, `/trust`, `/tenants` describe their respective stories.
5. **CI:** `ci` <4min, `evals` <12min, `deploy-microsite` succeeds to Vercel preview.
6. **Reproducibility:** a peer engineer cloning fresh can answer "what does this agent refuse to do, and why?" within 5 minutes of `git clone`.
7. **Launch-ready:** every item on the Launch Checklist (BUILD-SPEC.md) checked.

## When in doubt

- Re-read BUILD-SPEC.md and the four external context files.
- If a decision seems to conflict with the locked decisions: don't relitigate, ask the user.
- If a feature seems to need bypassing the will-never-automate list: don't bypass, ask the user.
- If hour pressure builds: walk the cut list in order. Don't improvise cuts.
