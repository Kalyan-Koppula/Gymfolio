# Gymfolio

Self-hosted family fitness app — workouts, macros, hydration, sleep, and progress.

## Monorepo

| Package | Role |
| --- | --- |
| `apps/web` | React / Vite / PWA |
| `apps/api` | Cloudflare Worker (Hono) + D1 + R2 + KV |
| `packages/shared` | Shared Zod schemas / types |
| `packages/db` | Drizzle schema + migrations + media seed |

## Local

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
```

Web: `http://localhost:5173` · API: `http://localhost:8787` (proxied as `/api`).

## Staging

Full infra, secrets hygiene (what belongs in git vs Worker secrets), deploy, and smoke checklist:

**[docs/STAGING.md](docs/STAGING.md)**

Quick local secrets setup:

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
# set MASTER_KEY, then: pnpm db:migrate:local && pnpm dev
```

## Brand

Product name is **Gymfolio** everywhere (PWA, WebAuthn RP name, OpenRouter title, UI).
