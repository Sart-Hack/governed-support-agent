# Deploy the microsite (Vercel)

The public microsite (`apps/microsite`) is a Next.js 15 app in this pnpm + Turborepo
monorepo. It is statically prerendered: the Cedar policy text, permission matrix,
tenant and refusal verdicts, and eval numbers are all baked at build time from
committed sources, so the deploy needs no runtime services, no database, and no
secret environment variables.

## One-time setup

1. Import `Sart-Hack/governed-support-agent` on [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `apps/microsite`. Leave "Include source files outside of
   the Root Directory" enabled (the build reaches up to the workspace root).
3. Framework preset: **Next.js** (auto-detected).
4. Leave Build and Install commands on **Override: off**. They come from
   `apps/microsite/vercel.json`:
   - install: `cd ../.. && pnpm install --frozen-lockfile`
   - build: `cd ../.. && pnpm turbo build --filter=@gsa/microsite`
   Turbo builds the workspace packages the site imports (`@gsa/policies`,
   `@gsa/fixtures`, `@sarthak/agent-shield`) before the Next build.
5. No environment variables are required.
6. Deploy.

## After setup

- Pushes to `main` publish a production deploy; pull requests get a preview URL.
- Link the production URL from the README hero and the `/trust` page footer.

## What is baked at build time

- `/policies`, `/permissions`, `/tenants`, `/refusals`: the exact `.cedar` files the
  agent enforces, read through `@gsa/policies` and evaluated through `agent-shield`
  in the generate-to-JSON step (committed JSON, drift-tested). No Cedar WASM runs in
  the Next build.
- `/evals`: reads `evals/results/latest.json` (committed). Regenerate with
  `pnpm eval` and commit when the numbers change.

## Local check (what Vercel runs)

```bash
pnpm install --frozen-lockfile
pnpm turbo build --filter=@gsa/microsite   # produces apps/microsite/.next
```
