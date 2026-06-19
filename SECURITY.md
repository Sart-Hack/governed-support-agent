# Security Policy

This is a demo repository for a solo AI consulting practice. The agent runs against mock systems and one real GitHub OAuth integration. Take care with anything you actually wire up against production credentials.

## Reporting a vulnerability

Email **sarthakgupta124@gmail.com** with `[gsa-security]` in the subject. Please describe the vulnerability, the reproduction steps, and the impact. I aim to acknowledge within 48 hours and to publish a fix or mitigation within 30 days for confirmed issues.

No bounty is offered. With your permission, fixed issues will be credited in the changelog.

Do not file public issues for unfixed security findings.

## Supply-chain stance

This project explicitly does **not** use:

- **LiteLLM** versions 1.82.7 or 1.82.8 (or any version) - affected by a March 2026 PyPI supply-chain attack that distributed credential-stealing malware. The chosen LLM gateway is Bifrost (Apache 2.0, Maxim AI).
- **Portkey** - acquired by Palo Alto Networks in April 2026; OSS roadmap uncertain. Not a security finding, but the rationale is the same trust-vector concern.

All package versions are pinned in `pnpm-lock.yaml`. Docker images are pinned to specific tags (e.g. `postgres:17`, `langfuse/langfuse:3`, `maximhq/bifrost:v1.5.5`). Run `pnpm audit --prod` and `osv-scanner` before any release.

## Audit posture

`pnpm audit --prod` is clean of **critical** advisories. The two that previously surfaced (a Next.js RCE and a middleware auth-bypass) were cleared by bumping Next.js to 15.5.19. The remaining advisories are all **transitive framework dependencies** with no path through this project's own code, and none are reachable in a static plus local-only demo:

- `form-data` (via `@slack/bolt`)
- `hono` x5 (via `@mastra/core`)
- `postcss` (via Next.js)
- `js-yaml`, `protobufjs`, `@opentelemetry/core` (via Mastra and OTel)
- `@ai-sdk/provider-utils`

These are tracked and revisited on framework updates rather than forced via `pnpm` overrides, since pinning a transitive dependency ahead of its parent framework carries more breakage risk than the advisories carry exposure in this demo's threat model. The MCP servers, Cedar evaluation, and agent runtime do not call into the affected code paths.

## Scope

In scope:
- The agent runtime, MCP servers, Cedar policy evaluation, kill-switch, audit log, circuit breaker
- The microsite (Next.js app) including any API routes
- Build/CI pipeline configuration

Out of scope:
- Issues in upstream dependencies (report to their maintainers; we'll bump versions)
- Demo credentials in `.env.example` (clearly marked, never used in production)
- Bifrost's empty-providers `infra/bifrost/config.json` placeholder

## Disclosure timeline

For accepted vulnerabilities: 90-day coordinated disclosure unless we agree otherwise.
