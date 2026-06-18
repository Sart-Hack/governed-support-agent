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

## Status

Phase 1 (foundation) complete. Phase 2 (agent core) complete: the agent runs end-to-end.

| Phase 2 milestone | Done |
|---|---|
| `@sarthak/agent-shield`: Cedar evaluator, audit, kill-switch, scope-check, circuit-breaker | ✅ |
| `@gsa/policies`: 8 Cedar policies mapped to OWASP ASI | ✅ |
| `@gsa/fixtures`: tickets, Notion KB, HubSpot accounts | ✅ |
| MCP servers: zendesk / notion / hubspot mocks + real-API github (full 2025-11-25 spec) | ✅ |
| `@gsa/mcp-client`: governed client with scope-check + Bifrost bootstrap | ✅ |
| Mastra v2 `support-ops` workflow wrapped by agent-shield | ✅ |
| `@gsa/tracing`: OTel GenAI spans to Langfuse | ✅ |
| Slack approval + suspend/resume on Postgres | ✅ |
| Postgres kill-switch + circuit-breaker | ✅ |

Next up: Phase 3 (microsite pages, eval suite, rrweb recordings, launch). See [BUILD-SPEC.md](./BUILD-SPEC.md).

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

## Licence

Apache 2.0. See [LICENSE](./LICENSE).
