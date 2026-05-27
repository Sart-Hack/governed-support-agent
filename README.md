# Governed Support Ops Agent

> **AI agents your security team will actually approve.** For US tech companies past Series A that need agents, not chatbots.

[![ci](https://github.com/Sart-Hack/governed-support-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/Sart-Hack/governed-support-agent/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](./LICENSE)
[![mcp](https://img.shields.io/badge/MCP-2025--11--25-8B5CF6.svg)](https://modelcontextprotocol.io)

---

## Two artifacts in one repo

1. **The Governed Support Ops Agent.** A runnable, end-to-end demo: watches a simulated Zendesk queue, reads Notion docs, checks HubSpot, files real GitHub issues, posts Slack updates, and requires human approval before any customer-facing action.

2. **`@sarthak/agent-shield`.** The governance layer pulled out as a reusable package: Cedar policies + append-only audit log + kill-switch + MCP scope check + circuit breaker. Public API: `shield({ policies, audit, killSwitch, scopeCheck, breaker }).wrap(workflow)`.

Both are pitched on the microsite: agent demo on `/`, `agent-shield` on `/shield`.

## Status

Phase 1 (foundation) — in progress.

| Milestone | Done |
|---|---|
| M1 monorepo scaffold (pnpm + Turborepo + strict TS + Biome + Vitest) | ✅ |
| M2 microsite shell (Next 15 + Geist + Tailwind v4 + Playwright) | ✅ |
| M3 agent shell (tsx + tsup + Vitest) | ✅ |
| M4 docker-compose (Langfuse v3 + Postgres + ClickHouse + Redis + MinIO + Bifrost) | ✅ |
| M5 CI workflow | ✅ |
| M6 LICENSE + SECURITY + README + fresh-clone smoke | ✅ |

Next up: Phase 2 hour-1 spikes (Mastra v2 `.suspend/.resume` against Postgres; Bifrost in front of three MCP mocks). See [BUILD-SPEC.md](./BUILD-SPEC.md) for the full plan.

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

Langfuse UI: http://localhost:3001 — login `demo@example.com` / `demodemo`.

Stack control:

```bash
pnpm stack:up        # start all services
pnpm stack:verify    # health-probe each
pnpm stack:logs      # follow logs
pnpm stack:down      # stop, keep volumes
pnpm stack:wipe      # stop and delete volumes
```

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

- [`BUILD-SPEC.md`](./BUILD-SPEC.md) — architecture, scenarios, hour budget, risk register, verification gate. Read it before writing code.
- [`CLAUDE.md`](./CLAUDE.md) — orientation for Claude Code sessions: locked decisions, anti-patterns, cut list, copy guide.

## Licence

Apache 2.0. See [LICENSE](./LICENSE).
