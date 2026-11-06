# Zerg

Zerg is an AI agent software factory: an app for interacting with a factory that orchestrates agents to build software of any kind, and an opinionated take on the right way to develop it. See [README.md](README.md) for the product vision.

This repo is developed almost entirely by AI agents, so this file is their main source of context. Keep it accurate when you change something it describes, and keep it high level.

Keep the README accurate too. Update it when Zerg's purpose, value, or status changes, and keep it written for people: what Zerg is and why it matters, not how it works. Technical detail belongs in this file.

## Current state

The repo is still close to the Better-T-Stack scaffold. Auth and deployment work, but there is no product code yet:

- `packages/backend/convex/schema.ts` is empty.
- `healthCheck.ts`, `privateData.ts`, the home and dashboard routes, and the "My App" title are placeholders. Replace them freely.
- There are no tests, linter, or CI yet, and the Lefthook pre-commit config has no jobs. `bun run check-types` and `bun run build` are the only automated checks, so also verify changes by running the app.

## Tech stack

- **Language and tooling:** TypeScript, Bun (package manager and script runner), Turborepo
- **Web app:** React 19, TanStack Start (SSR) and Router, TanStack Query and Form, Vite, Nitro
- **Backend:** Convex, for data, server functions, and realtime
- **Auth:** Better Auth, through the Convex component (`@convex-dev/better-auth`)
- **UI:** Tailwind CSS 4, shadcn/ui on Base UI
- **Environment:** Varlock
- **Hosting:** Vercel (web) and Convex (backend)

## Architecture

```
apps/web/          TanStack Start app, deployed to Vercel
packages/backend/  Convex functions and schema (convex/)
packages/ui/       Shared shadcn/ui primitives and global styles
packages/config/   Shared TypeScript config
scripts/           Deployment and environment scripts
```

- **Dependencies point toward the app.** `apps/web` depends on `@zerg/backend` and `@zerg/ui`. Those packages don't depend on the app or on each other.
- **Backend logic lives in Convex.** The web app calls Convex functions through the generated `api` from `@zerg/backend/convex/_generated/api`, and gets typed, reactive data in return. Don't put business logic or persistence in the web app.
- **Auth runs inside Convex.** `convex/auth.ts` configures Better Auth and `convex/http.ts` exposes its routes. `apps/web/src/routes/api/auth/$.ts` proxies browser auth requests to it, and `__root.tsx` fetches the token for SSR. Routes under `apps/web/src/routes/_auth/` require a signed-in user. Convex functions must check auth themselves, because the route gate only protects the UI.

## Working in the repo

```bash
bun install          # also generates apps/web/src/env.ts
bun run dev:setup    # first time only: configure the Convex project
bun run dev          # web on http://localhost:3001, plus Convex dev
bun run check-types
bun run build
```

`bun run dev:web` and `bun run dev:server` start one side at a time. Other scripts are in the root `package.json`.

- **Dependencies:** versions shared across packages go in the `catalog` in the root `package.json`.
- **Commits:** use Conventional Commits with a scope, such as `feat(deploy): ...`.

### Backend

- Read `packages/backend/convex/_generated/ai/guidelines.md` before writing Convex code. It overrides what you may remember about Convex APIs.
- Convex skills are in `packages/backend/.claude/skills/`.
- `convex/_generated/` is committed. Don't edit it by hand. `convex dev` regenerates it, and the regenerated files should be committed with the backend change.

### UI

- Reusable primitives go in `packages/ui`. Import them as `@zerg/ui/components/button`.
- App-specific components go in `apps/web/src/components`.
- Design tokens and global styles are in `packages/ui/src/styles/globals.css`.
- Add shared primitives from the repo root: `npx shadcn@latest add <component> -c packages/ui`. For app-specific blocks, run the CLI from `apps/web`.

### Environment

- `apps/web/.env.schema` defines the web app's environment. Run `bun run env:generate` after changing it.
- Read values through the generated `ENV` accessor in `apps/web/src/env.ts`, which is gitignored.
- Commit schemas. Keep secrets in ignored env files or the deployment platform.
- Bun's automatic env loading is off (`bunfig.toml`), because the framework integration loads Varlock. Run standalone tools that use Varlock from the app directory that owns the schema.
- Local values live in `packages/backend/.env.local` (written by Convex) and `apps/web/.env`. The web app needs `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL`.
- `SITE_URL` and `BETTER_AUTH_SECRET` are set on the Convex deployment with `npx convex env set`, not in Varlock.

## Deployment

Every merge to `master` deploys to production. Vercel runs `scripts/vercel-build.sh`:

- **Production:** `convex deploy` builds the web app, then pushes the Convex functions only if the build passes.
- **Preview:** only the web app is rebuilt, against the Convex URLs set for Vercel's Preview environment. Previews do not receive backend changes.

Vercel needs these set:

- **Production:** `CONVEX_DEPLOY_KEY` and `VITE_CONVEX_SITE_URL`. `convex deploy` supplies `VITE_CONVEX_URL`.
- **Preview:** `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL`.

**Never run `scripts/vercel-build.sh` locally with `VERCEL_ENV=production`.** Convex would read `CONVEX_DEPLOYMENT` from `.env.local` and deploy to production.

`bun run env:preview` and `bun run env:production` sync local env files to Vercel, and `bun run deploy:check` does a dry run.
