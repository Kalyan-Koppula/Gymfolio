# Gymfolio — staging setup guide

Complete operator runbook: secrets hygiene, Cloudflare resources, deploy, and smoke tests.
Follows [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) and [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

---

## 1. Vars vs secrets (do not leak credentials in git)

### Safe in git — `wrangler.toml` `[vars]` and bindings

| Item | Example | Why OK |
| --- | --- | --- |
| Environment label | `ENVIRONMENT = "staging"` | Not a credential |
| WebAuthn RP name / host / origin | `WEBAUTHN_RP_*` | Public browser config |
| D1 `database_id`, KV `id`, R2 `bucket_name` | UUIDs / names | Resource IDs, not keys |

Vars are **non-inheritable**: every `[env.*]` must declare its own `[env.*.vars]`.

### Never in git — Worker secrets

| Binding | Purpose | How to set |
| --- | --- | --- |
| `MASTER_KEY` | AES key material for BYOK AI key encryption | `wrangler secret put MASTER_KEY --env staging` |
| `YOUTUBE_API_KEY` | Optional YouTube Data API | `wrangler secret put YOUTUBE_API_KEY --env staging` |

To your Worker code, secrets look like any other `env` binding (`c.env.MASTER_KEY`). The difference is values are encrypted at rest and **write-only** in the dashboard / Wrangler (you cannot read them back).

### Worker secrets vs Secrets Store

- **Worker secrets** (`wrangler secret put`) — use this. Correct default for a single API Worker.
- **Secrets Store** (account-level, shared across Workers) — skip until multiple Workers need the same secret with ACL.

### Local development

```bash
cd apps/api
cp .dev.vars.example .dev.vars
# Edit MASTER_KEY (openssl rand -base64 48)
pnpm --filter api dev
```

- [`.dev.vars`](../apps/api/.dev.vars.example) is **gitignored**.
- Only [`.dev.vars.example`](../apps/api/.dev.vars.example) is committed.
- Do **not** put `MASTER_KEY` in `wrangler.toml` `[vars]`.

### If a secret was ever committed

The old placeholder `MASTER_KEY` in `wrangler.toml` was removed. If you ever put a **real** key in git:

1. Generate a new key and `wrangler secret put MASTER_KEY --env staging` (and prod).
2. Re-save any BYOK AI provider keys in the app (ciphertext depends on `MASTER_KEY`).
3. Consider rotating the git history only if a production-grade key was pushed.

---

## 2. Naming map (isolated per environment)

Never share D1 / R2 / KV / Workers across environments.

| Resource | Dev (local) | Staging | Prod (later) |
| --- | --- | --- | --- |
| Worker (API) | `gymfolio-api-dev` | `gymfolio-api-staging` | `gymfolio-api-prod` |
| D1 | `gymfolio-d1-dev` | `gymfolio-d1-staging` | `gymfolio-d1-prod` |
| R2 | `gymfolio-media-dev` | `gymfolio-media-staging` | `gymfolio-media-prod` |
| KV sessions | Miniflare placeholder | `gymfolio-sessions-staging` | `gymfolio-sessions-prod` |
| Pages (web) | Vite `:5173` | `gymfolio-web-staging` | `gymfolio-web-prod` |
| Hostname | `localhost` | `staging.gymfolio.<your-domain>` | `app.gymfolio.<your-domain>` |

Wrangler default (no `--env`) = **dev**. Staging = `--env staging`.

---

## 3. Architecture (same-origin)

Pages serves the SPA; the Worker owns `/api/*` on the **same hostname** so session cookies and WebAuthn stay simple (mirrors local Vite `/api` proxy).

```
Browser
  → https://staging.gymfolio.<domain>/          → Pages (gymfolio-web-staging)
  → https://staging.gymfolio.<domain>/api/*     → Worker (gymfolio-api-staging)
                                                    ├─ D1  gymfolio-d1-staging
                                                    ├─ R2  gymfolio-media-staging
                                                    └─ KV  gymfolio-sessions-staging
```

Route pattern (in [`apps/api/wrangler.toml`](../apps/api/wrangler.toml)):

```toml
[[env.staging.routes]]
pattern = "staging.gymfolio.example.com/api/*"
zone_name = "example.com"
```

- Pattern **must** end with `/*` so requests with query strings match.
- `zone_name` is the Cloudflare zone (apex), not the staging subdomain.
- Pages custom domain handles everything else; do **not** add a Worker route for `staging…/*` (that would steal the SPA).

---

## 4. Prerequisites

- Cloudflare account
- Domain on **Cloudflare DNS** (proxied orange-cloud for the staging hostname)
- Node + pnpm (repo root)
- `wrangler login` (or `CLOUDFLARE_API_TOKEN` in CI)

```bash
cd /path/to/Gymfolio
pnpm install
pnpm exec wrangler login
```

---

## 5. One-time: create staging resources

From `apps/api`:

```bash
cd apps/api

pnpm exec wrangler d1 create gymfolio-d1-staging
pnpm exec wrangler kv namespace create gymfolio-sessions-staging
pnpm exec wrangler r2 bucket create gymfolio-media-staging
```

Paste the returned **database_id** and KV **id** into `[env.staging]` in `wrangler.toml`:

- `[[env.staging.d1_databases]]` → `database_id`
- `[[env.staging.kv_namespaces]]` → `id`

R2 only needs `bucket_name = "gymfolio-media-staging"` (already set).

Commit those IDs — they are not secrets.

---

## 6. Configure non-secret staging vars + route

In `apps/api/wrangler.toml` under `[env.staging.vars]`:

```toml
ENVIRONMENT = "staging"
WEBAUTHN_RP_NAME = "Gymfolio"
WEBAUTHN_RP_ID = "staging.gymfolio.YOUR_DOMAIN"          # bare host, no scheme
WEBAUTHN_ORIGIN = "https://staging.gymfolio.YOUR_DOMAIN"
```

Uncomment and edit the route:

```toml
[[env.staging.routes]]
pattern = "staging.gymfolio.YOUR_DOMAIN/api/*"
zone_name = "YOUR_DOMAIN"
```

Passkeys created on `localhost` will **not** work on staging (different `rpID`) — expected.

---

## 7. Set Worker secrets (staging)

```bash
cd apps/api

# Generate offline, then paste when Wrangler prompts (avoids shell history)
openssl rand -base64 48
pnpm exec wrangler secret put MASTER_KEY --env staging

# Optional
pnpm exec wrangler secret put YOUTUBE_API_KEY --env staging
```

Confirm in Cloudflare dashboard → Workers → `gymfolio-api-staging` → Settings → Variables and Secrets:

- **Variables**: `ENVIRONMENT`, `WEBAUTHN_*` (plaintext OK)
- **Secrets**: `MASTER_KEY` (encrypted / hidden)

`[env.staging.secrets] required = ["MASTER_KEY"]` makes deploy fail if the secret is missing.

---

## 8. Migrate staging D1

```bash
# From apps/api — applies packages/db/migrations to the REMOTE staging DB only
pnpm exec wrangler d1 migrations apply gymfolio-d1-staging --remote --env staging
```

Or from repo root: `pnpm migrate:staging`.

Never run this against a prod database name. Seed exercise media into staging R2 only when ready (large upload; extend `seed:media` for `--remote` when you need it).

---

## 9. Deploy API

```bash
pnpm --filter api deploy:staging
# equivalent: cd apps/api && pnpm exec wrangler deploy --env staging
```

Smoke the Worker route (after DNS + route are live):

```bash
curl -sS https://staging.gymfolio.YOUR_DOMAIN/api/health
# → {"ok":true}
```

---

## 10. Deploy web (Pages)

```bash
# From repo root
pnpm --filter web build

# Once
pnpm exec wrangler pages project create gymfolio-web-staging

pnpm exec wrangler pages deploy apps/web/dist --project-name=gymfolio-web-staging
```

Then in the Cloudflare dashboard (or CLI):

1. Pages → `gymfolio-web-staging` → Custom domains → add `staging.gymfolio.YOUR_DOMAIN`.
2. Ensure DNS CNAME/proxied record exists for that hostname.
3. SPA fallback is shipped via [`apps/web/public/_redirects`](../apps/web/public/_redirects) (`/* → /index.html`).

Order of operations tip: attach the Pages custom domain **before** or **with** the Worker `/api/*` route so the hostname resolves; the more-specific Worker route wins for `/api/*`.

---

## 11. Smoke checklist

- [ ] `GET /api/health` → `{"ok":true}`
- [ ] Fresh D1: open site → onboarding / register owner
- [ ] Session cookie is `Secure` (staging `ENVIRONMENT !== "development"`)
- [ ] Password login works
- [ ] Register a passkey on the **staging** origin
- [ ] Start / finish a workout; resume bar clears after finish
- [ ] Exercise media loads from staging R2 (after seed)
- [ ] PWA name shows **Gymfolio**
- [ ] Dashboard shows no plaintext `MASTER_KEY` under Variables

---

## 12. Local after secrets hygiene

```bash
cd apps/api && cp .dev.vars.example .dev.vars   # if needed
pnpm db:migrate:local
pnpm seed:media -- --limit 20                   # optional
pnpm dev
```

Local D1/R2 names: `gymfolio-d1-dev` / `gymfolio-media-dev`.

---

## 13. CI sketch (optional)

1. Create an API token with Workers, D1, Pages, Account read (least privilege).
2. Store as GitHub Actions secret `CLOUDFLARE_API_TOKEN` (and `CLOUDFLARE_ACCOUNT_ID` if required).
3. Deploy job:
   - `pnpm --filter web build`
   - `pnpm exec wrangler pages deploy apps/web/dist --project-name=gymfolio-web-staging`
   - `pnpm --filter api deploy:staging`
4. **Do not** put secret *values* in workflow YAML. Set `MASTER_KEY` once via CLI/dashboard. To rotate in CI, pipe from the Actions secret store:

```bash
echo "$MASTER_KEY" | pnpm exec wrangler secret put MASTER_KEY --env staging
```

Prefer rotating secrets rarely and out-of-band.

---

## 14. Prod (later)

Mirror staging with `*-prod` resource names and `[env.production]` in `wrangler.toml`. Never reuse staging D1/R2/KV. Separate `MASTER_KEY`. Same Pages + `/api/*` route pattern on `app.gymfolio.<domain>`.
