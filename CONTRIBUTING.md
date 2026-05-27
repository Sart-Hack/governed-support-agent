# Contributing

This is a demo repository for a solo consulting practice. Slow merges are the default.

If you want to contribute:

1. **Open an issue first.** Describe what you want to change and why. Wait for a reply before opening a PR.
2. **Keep PRs small.** One concern per PR. Tests included.
3. **Local CI parity.** Before pushing, run `pnpm lint && pnpm typecheck && pnpm test`. CI runs the same commands and must be green for a merge.
4. **No new dependencies without rationale.** Justify in the issue: what does this enable, why is the existing toolchain insufficient, what is the maintenance cost.

Cedar policies, MCP server contracts, and `agent-shield` public API are intentionally stable. Breaking changes need a strong reason.

## Local setup

See [README.md](./README.md#run-locally) for the clone-and-run path.

## Code of Conduct

By participating, you agree to the [Contributor Covenant 2.1](./CODE_OF_CONDUCT.md).
