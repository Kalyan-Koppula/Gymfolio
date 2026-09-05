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

Infrastructure naming and deploy steps: **[docs/STAGING.md](docs/STAGING.md)**.

## Brand

Product name is **Gymfolio** everywhere (PWA, WebAuthn RP name, OpenRouter title, UI).
