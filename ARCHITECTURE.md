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

### Spike 2 — Bifrost in front of 3 MCP mocks

**Status:** Not yet started. Up next.

(Outcome TBD. Goal: confirm Bifrost's code-mode token compression works across multi-MCP routing before committing the "11µs overhead at 5k RPS" pitch on the microsite.)
