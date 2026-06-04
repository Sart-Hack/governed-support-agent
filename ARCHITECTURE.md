# Architecture

Living architecture notes for the Governed Support Ops Agent. The full design rationale lives in [`BUILD-SPEC.md`](./BUILD-SPEC.md); this file records architectural decisions made as they land in code, starting with the Phase 2 entry spikes.

---

## Phase 2 — entry spikes

Two risks from the BUILD-SPEC risk register were de-risked before any deep agent-core work. Spike outcomes are recorded here so future sessions can see what was tried, what passed, and what the canonical-vs-fallback decision was.

### Spike 1 — Mastra v2 `.suspend()` / `.resume()` durability against Postgres

**Status:** PASSED on 2026-05-27. Canonical path adopted. No fallback needed.

**Risk being tested:** BUILD-SPEC risk #1 — Mastra v2 workflow API is the locked choice over `workflows-legacy` (different suspend semantics). If v2's Postgres-backed suspend/resume didn't survive a process restart + DB restart, the entire HITL story for scenarios 2/3/5 would need a hand-rolled checkpoint table with explicit pause/resume HTTP endpoints.

**Setup:**

- Spike code: `apps/agent/src/spike-suspend-resume.ts` — single file, 2-step workflow (`announce` → `awaitApproval` (suspends) → `finalize`), CLI dispatch on `start` vs `resume <runId>`.
- Storage: `PostgresStore` from `@mastra/pg@1.11.1` against the `mastra` logical DB pre-created by `infra/postgres/init.sql`. Conn string: `postgresql://postgres:postgres@localhost:5432/mastra` (`MASTRA_DATABASE_URL`).
- Run scripts (`apps/agent/package.json`):
  - `pnpm --filter @gsa/agent spike:mastra:start` — starts a new run, suspends, prints the runId, exits.
  - `pnpm --filter @gsa/agent spike:mastra:resume <runId>` — fresh process, rehydrates the run by ID, supplies the approval payload, prints the final output.

**Test sequence (2026-05-27):**

1. `pnpm --filter @gsa/agent spike:mastra:start` → `[announce]` ran, `[awaitApproval]` suspended, returned `status=suspended` with `runId=cdfb9d9d-…`.
2. Verified `SELECT run_id, workflow_name, status FROM mastra_workflow_snapshot WHERE run_id = '<runId>'` returned `status=suspended`.
3. `docker compose restart postgres` — container fully restarted, healthy again in ~6s.
4. `pnpm --filter @gsa/agent spike:mastra:resume <runId>` (fresh Node process, fresh connection pool) → `[awaitApproval] resumed`, `[finalize]` ran, returned `status=success` with output `{ ticketId: "TCK-42", finalState: "accepted", approver: "sarthak@demo" }`.

**Discoveries worth keeping:**

- **`PostgresStore` requires `id`.** `new PostgresStore({ connectionString })` throws `MASTRA_STORAGE_PG_INITIALIZATION_FAILED: id must be provided and cannot be empty`. The public docs example omits `id`; in `@mastra/pg@1.11.1` it's enforced. Use `new PostgresStore({ id: "gsa-mastra-store", connectionString })`.
- **`suspend()` is not a halt — it's a sentinel.** The idiomatic v2 pattern is `return await suspend(suspendPayload)`. Calling `await suspend(...)` and then continuing execution (e.g. throwing) fails the step. The return value of `suspend()` is typed as the step's `InnerOutput`, so `return await suspend(...)` typechecks against the step's `outputSchema`.
- **`result.suspended` is a nested path array.** For a single top-level suspended step the value is `[["awaitApproval"]]`, not `["awaitApproval"]`. When calling `run.resume()`, passing the step ID as a plain string (`step: "awaitApproval"`) works and is the more ergonomic form; the typed form is `step: result.suspended[0]`.
- **Method is `createRun` (returns `Promise<Run>`), not `createRunAsync`.** The `.d.ts` overloads list multiple internal `_start` / `_resume` variants — those are protected and not the public surface.
- **`@mastra/core` package version is 1.37.0, but the workflow API is "v2".** The v2/legacy split in CLAUDE.md refers to the workflow API generation. In v1.37 there's no `workflows-legacy` subpath shipped — `@mastra/core/workflows` is v2 by default. Imports for the project: `import { createWorkflow, createStep } from "@mastra/core/workflows"` and `import { Mastra } from "@mastra/core"`.
- **Zod v3 is required.** Mastra's transitive `@ai-sdk/*` deps peer-depend on `zod@^3.23.8`. The workspace had hoisted `zod@4`; `apps/agent` now pins `zod@^3.23.8` directly to silence the peer-dep warning and avoid v4 breaking changes in schema parsing.

**Phase-2 implication:** Mastra v2 with `PostgresStore` is the workflow engine for the agent. The HITL story (Slack approval → suspend → human acts → resume) can be built directly on `run.suspend()` / `run.resume()` without a custom checkpoint table. The spike file stays in the repo as a smoke test for future Mastra upgrades — re-run it after any `@mastra/*` bump.

---

### Spike 2 — Bifrost as multi-MCP gateway

**Status:** PASSED (load-bearing question) on 2026-05-27. Canonical path adopted. Code-mode token-compression end-to-end verification deferred to Phase 2 main work (requires `ANTHROPIC_API_KEY`, which is not yet populated in `.env`).

**Risk being tested:** BUILD-SPEC risk #8 — Bifrost is newer than Portkey and the "Bifrost in front of 3 MCPs" + code-mode pitch needs to be real. If the gateway couldn't multiplex MCP clients, the fallback was a direct MCP client per server (loses gateway-level observability, central kill-switch, and code-mode).

**Setup:**

- Spike code: `apps/agent/src/spike-mcp-mock-server.ts` — single Node HTTP process exposing three Streamable-HTTP MCP endpoints, one tool each. Stateless mode (fresh `McpServer` + transport per POST, per the SDK's canonical `simpleStatelessStreamableHttp` example).
- Run script: `pnpm --filter @gsa/agent spike:mcp:server` (binds `0.0.0.0:7001`).
- Routes:
  - `POST /mcp/zendesk` → `list_tickets`
  - `POST /mcp/notion` → `search_docs`
  - `POST /mcp/hubspot` → `find_account`
- Bifrost reaches the mock via `http://host.docker.internal:7001/mcp/<svc>`.

**Test sequence (2026-05-27):**

1. Started mock — confirmed `POST /mcp/zendesk` with a JSON-RPC `initialize` request returns HTTP 200 + `event: message data: {...}` SSE frame with the right `serverInfo.name`.
2. `POST /api/mcp/client` against Bifrost three times (one per service). All returned `{"message":"MCP client connected successfully"}`.
3. `GET /api/mcp/clients` returned `count: 3` with all three in `state: connected`, each with its declared tool listed in the `tools[]` array — Bifrost successfully discovered the tools across multiple MCP clients.
4. `POST /v1/mcp/tool/execute` directly returned `"tool '<name>' is not available or not permitted"` for every tool. This is by design: that endpoint expects a prior chat-completion context (the `extra_fields.request_type` echoes `chat_completion`). Tools become "permitted" when the LLM emits a `tool_call` after Bifrost surfaces them in a chat request — the execute endpoint is the back-half of that flow, not a standalone dispatcher.
5. Attempted the front-half (`POST /v1/chat/completions` with `model: anthropic/claude-haiku-4-5` and `tool_choice: auto`) → failed because no Anthropic provider was registered AND `ANTHROPIC_API_KEY` in `.env` is empty. Provider registered + deleted during the test; key remains unset.

**Discoveries worth keeping:**

- **The MCP TS SDK's `StreamableHTTPServerTransport` is single-use.** Reusing one `McpServer` + transport across requests breaks: the first `initialize` succeeds, every subsequent request returns HTTP 500 with `text/plain` body and no server-side log. The canonical pattern (from `simpleStatelessStreamableHttp.ts`) is: instantiate a fresh `McpServer` + `StreamableHTTPServerTransport` per POST, `await server.connect(transport); await transport.handleRequest(req, res)`, and close both in `res.on("close", ...)`. This is what the spike mock now does.
- **Bifrost MCP-client names cannot contain hyphens.** `mock-zendesk` is rejected with `Invalid client name: name cannot contain hyphens`. Use underscores (`mock_zendesk`).
- **Editing a Bifrost MCP client via `PUT /api/mcp/client/{id}` requires the `name` field in the body** even when you only want to change one field — omitting it fails with `name is required for MCP client`.
- **`host.docker.internal` resolves inside the Bifrost container on Docker Desktop for Mac** — both IPv4 (`192.168.65.254`) and IPv6 are populated. The mock binds `0.0.0.0` and is reachable. (On Linux this requires `extra_hosts: ["host.docker.internal:host-gateway"]` in `docker-compose.yml`, which is currently NOT set — flag for Phase 2 if cross-platform repro matters before then.)
- **Bifrost's MCP tool execution is LLM-driven, not standalone.** The "are these tools available?" check on `/v1/mcp/tool/execute` depends on the tools having been surfaced in a prior `/v1/chat/completions` call. There is no documented way to invoke an MCP tool directly through Bifrost without going through a chat completion. For Phase 2 testing without burning LLM credits, call the MCP mock directly (bypassing Bifrost) — Bifrost's value is in the LLM-driven path.
- **Bifrost persists MCP client + provider state in `infra/bifrost/config.db` (SQLite).** The current `infra/bifrost/config.json` only has `{"providers": {}}`. Runtime state (added providers, MCP clients) survives container restart but does NOT survive a fresh clone. Phase 2 needs an init script or canonical `config.json` that pre-registers the 3 MCP clients so cloning works on a new machine.

**Phase-2 implication:** Bifrost as MCP gateway is the canonical path. The 3 MCP mocks already used here (`mock_zendesk`, `mock_notion`, `mock_hubspot`) are good stand-ins for the demo scenario domain; Phase 2 main work can grow them into the real mocks. Two follow-ups before claiming the "11µs overhead at 5k RPS" pitch on the microsite:

1. Populate `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` in `.env`, then end-to-end test `POST /v1/chat/completions` → LLM emits `tool_call` → `POST /v1/mcp/tool/execute` succeeds. This proves code-mode is live (or surfaces a real bug to fix).
2. Decide where the canonical MCP client config lives: a `config.json` blob shipped in the repo, or an idempotent `scripts/bootstrap-bifrost.sh` that POSTs the 3 clients on first boot. Either way, fresh-clone must work without manual API calls.

The spike mock and registration setup can stay registered in the local Bifrost SQLite — Phase 2 main work absorbs them.

**Follow-up #2 RESOLVED (P2-M5, 2026-06-04).** Canonical MCP client config lives in an idempotent script, `scripts/bootstrap-bifrost.mjs` (run via `pnpm stack:bootstrap`), not a `config.json` blob. Reason: Bifrost makes a client's `connection_string` immutable after creation and masks it in `GET /api/mcp/clients` responses, so an in-place diff is impossible. The script reconciles instead: it deletes any client carrying one of our three names, then recreates all three pointing at `host.docker.internal:{7002,7003,7004}/mcp`. End state is deterministic on every run, so a fresh clone gets a working gateway with one command. Verified live: all three report `state: connected` and Bifrost aggregates their full tool lists (5 zendesk + 2 notion + 3 hubspot). Two new gotchas: (a) `PUT /api/mcp/client/{id}` rejects any change to `connection_string` with `connection_string cannot be changed for an existing MCP client` — delete-and-recreate is the only path; (b) `host.docker.internal` needs `extra_hosts: ["host.docker.internal:host-gateway"]` on the bifrost service for Linux parity — now added to `docker-compose.yml` (Docker Desktop on Mac/Windows maps it automatically).

Follow-up #1 (LLM → `tool_call` → `mcp/tool/execute` end-to-end) remains open, gated on populating an LLM key in `.env`; it closes in P2-M6 when the Mastra workflow first calls Bifrost as its LLM endpoint.
