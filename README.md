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

## Staging (from your laptop)

```bash
pnpm staging:secrets      # MASTER_KEY + B2_* → Worker
pnpm staging:migrate      # remote D1
pnpm staging:seed:smoke   # 20 exercises → staging D1 + B2
pnpm staging:deploy       # API Worker + Pages
```

Full list: [docs/STAGING.md](docs/STAGING.md) (Local staging commands).

## Brand

Product name is **Gymfolio** everywhere (PWA, WebAuthn RP name, OpenRouter title, UI).

## Media storage

Exercise media can live on **Cloudflare R2** (`MEDIA_BACKEND=r2`, default) or **Backblaze B2** (`MEDIA_BACKEND=b2`). See [docs/STAGING.md](docs/STAGING.md) §1a.
