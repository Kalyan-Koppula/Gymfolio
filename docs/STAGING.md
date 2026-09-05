# Gymfolio — staging deploy plan

Clean naming: every Cloudflare resource is prefixed with **`gymfolio`** and suffixed with the environment (`dev` | `staging` | `prod`). Never share D1 / R2 / KV / Workers across environments.

## Naming map

| Resource | Dev (local) | Staging | Prod (later) |
| --- | --- | --- | --- |
| Worker (API) | `gymfolio-api-dev` | `gymfolio-api-staging` | `gymfolio-api-prod` |
| D1 database | `gymfolio-d1-dev` | `gymfolio-d1-staging` | `gymfolio-d1-prod` |
| R2 media bucket | `gymfolio-media-dev` | `gymfolio-media-staging` | `gymfolio-media-prod` |
| KV sessions | *(Miniflare / placeholder)* | `gymfolio-sessions-staging` | `gymfolio-sessions-prod` |
| Web (static / Pages) | Vite `:5173` | `gymfolio-web-staging` | `gymfolio-web-prod` |
| Hostname | `localhost` | `staging.gymfolio.<your-domain>` | `app.gymfolio.<your-domain>` (or apex) |

Wrangler default (no `--env`) = **dev**. Staging = `--env staging`.

## Architecture (staging)

```
Browser  →  https://staging.gymfolio.<domain>     (Pages / static assets + SW)
         →  /api/*  (same origin via Pages Functions proxy OR Worker route)
                    →  gymfolio-api-staging
                         ├─ D1  gymfolio-d1-staging
                         ├─ R2  gymfolio-media-staging
                         └─ KV  gymfolio-sessions-staging
```

Preferred: one hostname for web + API (cookie + WebAuthn stay simple). Options:

1. **Pages + Worker route** — Pages serves the Vite build; attach Worker on `staging…/api/*`.
2. **Worker serves API only** — Pages `staging…`; Worker on `api.staging…` with CORS + cookie `Domain` tuned (more moving parts — avoid for v1 staging).

## One-time Cloudflare setup

```bash
# From apps/api (or repo root with cwd set)
pnpm exec wrangler login

# D1
pnpm exec wrangler d1 create gymfolio-d1-staging

# KV
pnpm exec wrangler kv namespace create gymfolio-sessions-staging

# R2
pnpm exec wrangler r2 bucket create gymfolio-media-staging
```

Paste the returned IDs into `apps/api/wrangler.toml` under `[env.staging]` (`database_id`, KV `id`).

## Secrets & WebAuthn (staging)

```bash
# 32+ byte random key for BYOK encryption
pnpm exec wrangler secret put MASTER_KEY --env staging

# Optional
pnpm exec wrangler secret put YOUTUBE_API_KEY --env staging
```

In `[env.staging.vars]` set:

- `WEBAUTHN_RP_ID` = bare host, e.g. `staging.gymfolio.example.com`
- `WEBAUTHN_ORIGIN` = `https://staging.gymfolio.example.com`
- `WEBAUTHN_RP_NAME` = `Gymfolio` (already set)

Passkeys created on localhost will **not** work on staging (different rpID) — expected.

## Migrate + seed staging

```bash
pnpm exec wrangler d1 migrations apply gymfolio-d1-staging --remote --env staging
# Seed media only when ready (uploads to staging R2 — can be large):
# point seed scripts at --env staging / remote R2 (extend seed:media when you need it)
```

## Deploy API

```bash
pnpm --filter api exec wrangler deploy --env staging
```

## Deploy web

```bash
pnpm --filter web build
# Then publish apps/web/dist to Pages project gymfolio-web-staging
# wrangler pages project create gymfolio-web-staging
# wrangler pages deploy apps/web/dist --project-name=gymfolio-web-staging
```

Wire custom domain `staging.gymfolio.<domain>` on that Pages project. Ensure `/api` reaches `gymfolio-api-staging` (Pages `_routes` / Function proxy or Worker route).

## CI sketch (optional)

- Branch `main` → staging deploy (API `--env staging` + Pages staging project)
- Tag / `release` branch → prod (`--env production` — add when ready)
- Never apply staging migrations to prod D1; never point staging Worker at prod bindings

## Smoke checklist after first staging deploy

- [ ] `GET https://staging…/api/…` health / bootstrap
- [ ] Register owner on empty D1
- [ ] Login + passkey register on staging origin
- [ ] Start / finish a workout; resume bar clears
- [ ] Media thumb loads from staging R2
- [ ] PWA install shows **Gymfolio**

## Local note after the rename

Local D1/R2 names are now `gymfolio-d1-dev` / `gymfolio-media-dev`. Re-apply migrations and re-seed if your old `fitness-tracker` Miniflare DB is empty under the new names:

```bash
pnpm db:migrate:local
pnpm seed:media -- --limit 20   # or full seed
```
