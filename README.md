# Governed Support Ops Agent

> **AI agents your security team will actually approve.** For US tech companies past Series A that need agents, not chatbots.

[![ci](https://github.com/Sart-Hack/governed-support-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/Sart-Hack/governed-support-agent/actions/workflows/ci.yml)
[![evals](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Sart-Hack/governed-support-agent/main/evals/results/badge.json)](./apps/agent/src/eval)
[![license](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](./LICENSE)
[![mcp](https://img.shields.io/badge/MCP-2025--11--25-8B5CF6.svg)](https://modelcontextprotocol.io)

---

## Two artifacts in one repo

1. **The Governed Support Ops Agent.** A runnable, end-to-end demo: watches a simulated Zendesk queue, reads Notion docs, checks HubSpot, files real GitHub issues, posts Slack updates, and requires human approval before any customer-facing action.

2. **`@sarthak/agent-shield`.** The governance layer pulled out as a reusable package: Cedar policies + append-only audit log + kill-switch + MCP scope check + circuit breaker. Public API: `shield({ policies, audit, killSwitch, scopeCheck, breaker }).wrap(workflow)`.

Both are pitched on the microsite: agent demo on `/`, `agent-shield` on `/shield`.

## Why this isn't another chat demo

Three things a chatbot wrapper does not do:

- **Policy is code, in version control.** Every tool call is authorized against Cedar policies that live in [`packages/policies/`](./packages/policies/policies/), the exact files the microsite renders. A refusal comes back with a human-readable reason chain mapped to an OWASP Agentic threat, not a shrug.
- **There is a kill-switch and a circuit breaker.** An operator can halt an in-flight run at the next step boundary, and a runaway loop trips a cost ceiling before it bills you for an overnight retry storm.
- **Indirect prompt injection is handled, not hoped away.** Untrusted content the agent retrieves, like a poisoned knowledge-base page, is scanned and quarantined before it reaches the planner, so injected instructions never become actions.

## Status

Complete and runnable end-to-end. A Mastra v2 workflow wrapped by `agent-shield`
takes a ticket through classify, retrieve, policy-check, human approval, governed
execute, and audit, with a full OpenTelemetry trace tree in Langfuse.

| Capability | State |
|---|---|
| 8 Cedar policies mapped to the OWASP Agentic Top 10 (ASI01-ASI10) | ✅ |
| 8 scenarios fire end-to-end: allow, approval gate, PII redaction, delete refusal, indirect injection, cost breaker, kill-switch, cross-tenant | ✅ |
| MCP servers: zendesk / notion / hubspot mocks + real-API GitHub (full 2025-11-25 spec) | ✅ |
| Slack approval with suspend/resume on a Postgres checkpoint | ✅ |
| OTel GenAI spans to Langfuse, `agent.policy.decision.reasons` on every governed step | ✅ |
| Eval suite: custom 21/21, OWASP-ASI 10/10, InjecAgent subset 200/200 | ✅ |
| Microsite: 11 routes, every page real (policies, traces, refusals, evals, shield, trust, tenants) | ✅ |

See [BUILD-SPEC.md](./BUILD-SPEC.md) for the architecture and the verification gate.

## Run locally

Requires Node 22+, pnpm 9, Docker Desktop, ~3 GB free disk for images on first pull.

```bash
git clone git@github.com:Sart-Hack/governed-support-agent.git
cd governed-support-agent

corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install

cp .env.example .env             # demo secrets, do not deploy
pnpm stack:up                    # pulls + starts Langfuse v3 + Postgres + ClickHouse + Redis + MinIO + Bifrost
pnpm stack:verify                # 7/7 service smokes

pnpm --filter @gsa/microsite dev # microsite on http://localhost:3000
pnpm --filter @gsa/agent dev     # agent CLI in watch mode
```

Langfuse UI: http://localhost:3001, login `demo@example.com` / `demodemo`.

Stack control:

```bash
pnpm stack:up        # start all services
pnpm stack:verify    # health-probe each
pnpm stack:bootstrap # register the 3 mock MCP servers as Bifrost clients (idempotent)
pnpm stack:logs      # follow logs
pnpm stack:down      # stop, keep volumes
pnpm stack:wipe      # stop and delete volumes

pnpm mcp:servers     # run the 4 MCP servers (zendesk 7002, notion 7003, hubspot 7004, github 7005)
```

The MCP servers run as host processes; Bifrost (in Docker) reaches them via
`host.docker.internal`. Start them with `pnpm mcp:servers`, then `pnpm stack:bootstrap`
registers them with the gateway. Bootstrap is idempotent: it reconciles to a known
state every run, so a fresh clone needs only `pnpm stack:up && pnpm stack:bootstrap`.

## Run the agent

With the stack up and `pnpm mcp:servers` running in another terminal (and an
`OPENAI_API_KEY` in `.env`):

```bash
pnpm demo                  # scenario 1: triage a billing ticket end-to-end,
                           # then print the Langfuse trace link

pnpm --filter @gsa/agent scenario TCK-3        # scenario 3: drafts a customer reply,
                                               # suspends at the Slack approval gate
pnpm --filter @gsa/agent scenario:resume <runId> reject "needs detail"   # revise branch

pnpm --filter @gsa/agent scenario2             # scenario 2: runaway loop hits the
                                               # $0.50 circuit-breaker ceiling
pnpm --filter @gsa/agent kill on               # scenario 7: kill-switch halts in-flight runs
```

Every tool call is double-gated (Cedar policy + scope-check), every step is
audited, and a full trace tree lands in Langfuse. Slack and GitHub run against a
local stand-in / mock until you add `SLACK_BOT_TOKEN` or `GITHUB_TOKEN` to `.env`.

## Local CI parity

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @gsa/microsite build
pnpm --filter @gsa/agent build
```

Same commands run in `.github/workflows/ci.yml`. ~46s on a clean runner.

## Source of truth

- [`BUILD-SPEC.md`](./BUILD-SPEC.md): architecture, scenarios, hour budget, risk register, verification gate. Read it before writing code.
- [`CLAUDE.md`](./CLAUDE.md): orientation for Claude Code sessions, including locked decisions, anti-patterns, cut list, copy guide.

## License

Apache 2.0. See [LICENSE](./LICENSE).
