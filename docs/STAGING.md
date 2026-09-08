# Gymfolio — staging setup guide

Complete operator runbook: secrets hygiene, **free Cloudflare hostnames** (`*.pages.dev` / `*.workers.dev`), branch-based self-deploy, and smoke tests.

Follows [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) and [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

---

## Local staging commands (run from your machine)

Prerequisites: `pnpm install`, `wrangler login`, and B2 + `MASTER_KEY` in [`apps/api/.dev.vars`](../apps/api/.dev.vars.example).

```bash
# 1) Push secrets to the staging Worker (once, or when rotating)
pnpm staging:secrets
# Inspect: staging secret *names* + local .dev.vars values (CF never returns secret values)
pnpm staging:secrets:print

# 2) Apply D1 migrations on remote staging
pnpm staging:migrate

# 3a) Smoke-seed 20 exercises → staging D1 + Backblaze B2
pnpm staging:seed:smoke

# 3b) Full catalog (process images + upload B2 + write D1) — slow / large
pnpm staging:seed

# 3c) If local .cache/free-exercise-db/out already has WebPs (processing done):
pnpm staging:seed:upload   # hash + upload WebPs → B2, update D1 media keys
pnpm staging:seed:d1       # full catalog → remote D1 (includes hashed media_json)

# Media object keys are content-addressed: exercises/{slug}/thumb.<hash>.webp
# Run staging:migrate first so exercises.media_json exists.

# Broken thumbs usually mean D1 has has_gif=1 but B2 is missing the object
# (d1-only without a completed upload), or upload never finished. Run 3c both steps.
# 4) Deploy API + Pages from this machine
pnpm staging:deploy
# or:
pnpm staging:deploy:api
pnpm staging:deploy:web
```

`staging:seed*` uses `--staging` (remote D1 `gymfolio-d1-staging`, default media backend **b2**).

### Faster media (Cloudflare edge cache + content hashes)

Object keys are **content-addressed** after seed:

`exercises/{slug}/thumb.<16-hex>.webp` (also `start` / `end`)

D1 stores keys in `media_json` (+ `gif_r2_key` for the thumb). Clients load those URLs, so CDN `immutable` caching is safe — a re-encode produces a new hash/URL.

Thumbs are slow when every request goes **Pages → Worker → B2**. After deploy:

1. **API** caches media in the Workers Cache API (`X-Media-Cache: HIT` on repeats).
2. Set Pages build env **`VITE_MEDIA_ORIGIN`** to the Worker origin (no trailing slash), e.g.  
   `https://gymfolio-api-staging.<subdomain>.workers.dev`  
   so the browser loads `/api/media/...` **directly from the Worker** (skips the Pages proxy hop).

Reseed hashed objects (local WebPs already built):

```bash
pnpm staging:migrate
pnpm staging:seed:upload
pnpm staging:seed:d1
pnpm staging:deploy:api
```

Redeploy web after setting `VITE_MEDIA_ORIGIN`.

---

## 0. Hosting model (free Cloudflare — no purchased domain)

You do **not** need to buy a domain. Use Cloudflare’s free hostnames:

| Surface | Free URL | Product |
| --- | --- | --- |
| Web (SPA + `/api` proxy) | `https://gymfolio-web-staging.pages.dev` | [Cloudflare Pages](https://developers.cloudflare.com/pages/) |
| API Worker | `https://gymfolio-api-staging.<workers-subdomain>.workers.dev` | [Workers](https://developers.cloudflare.com/workers/) + D1 + R2 + KV |

Find your **workers subdomain** in the dashboard: Workers & Pages → Overview (or after first `wrangler deploy`, Wrangler prints the URL). It looks like `https://gymfolio-api-staging.abc123.workers.dev`.

### Why a Pages Function proxy?

Browsers call relative `/api/…` (see [`apps/web/src/lib/api-client.ts`](../apps/web/src/lib/api-client.ts)). `pages.dev` and `workers.dev` are **different sites**, so a bare split would break session cookies and WebAuthn.

[`apps/web/functions/api/[[path]].ts`](../apps/web/functions/api/[[path]].ts) runs on Pages and proxies `/api/*` to the Worker. The browser only talks to `*.pages.dev` → same-origin cookies + passkeys work on the free hostname.

```
Browser
  → https://gymfolio-web-staging.pages.dev/           → Pages static assets
  → https://gymfolio-web-staging.pages.dev/api/*      → Pages Function
                                                         → fetch(GYMFOLIO_API_ORIGIN + /api/…)
                                                         → gymfolio-api-staging.*.workers.dev
                                                              ├─ media (R2 or Backblaze B2)
                                                              ├─ D1  gymfolio-d1-staging
                                                              └─ KV  gymfolio-sessions-staging
```

**WebAuthn** must use the **Pages** host (what the user sees in the address bar):

```toml
WEBAUTHN_RP_ID = "gymfolio-web-staging.pages.dev"
WEBAUTHN_ORIGIN = "https://gymfolio-web-staging.pages.dev"
```

### Optional later: your own domain

When you have a zone on Cloudflare DNS, you can put Pages + a Worker route on `staging.gymfolio.example.com` (true `/api/*` route, no proxy). Keep the free path until then; see §15.

---

## 1a. Media storage: Cloudflare R2 or Backblaze B2

Exercise images are served by the API from object storage. Choose one backend via the non-secret var `MEDIA_BACKEND`:

| Value | Store | Config |
| --- | --- | --- |
| `r2` (default) | Cloudflare R2 | `[[r2_buckets]]` binding `MEDIA` in `wrangler.toml` |
| `b2` | Backblaze B2 (S3-compatible) | Secrets: `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET`, `B2_ENDPOINT` (+ optional `B2_REGION`) |

In [`apps/api/wrangler.toml`](../apps/api/wrangler.toml):

```toml
MEDIA_BACKEND = "r2"   # or "b2"
```

### Using Backblaze B2

1. Create a B2 bucket + application key with read/write on that bucket.
2. Note the **S3-compatible endpoint** (Bucket settings → S3 endpoint), e.g. `https://s3.us-west-004.backblazeb2.com`.
3. Set `MEDIA_BACKEND = "b2"` in `[vars]` / `[env.staging.vars]`.
4. Local — add to `apps/api/.dev.vars` (see `.dev.vars.example`).
5. Staging:

```bash
cd apps/api
pnpm exec wrangler secret put B2_KEY_ID --env staging
pnpm exec wrangler secret put B2_APPLICATION_KEY --env staging
pnpm exec wrangler secret put B2_BUCKET --env staging
pnpm exec wrangler secret put B2_ENDPOINT --env staging
# optional: wrangler secret put B2_REGION --env staging
```

6. Seed uploads:

```bash
pnpm seed:media -- --backend b2 --limit 20
# or MEDIA_BACKEND=b2 in .dev.vars / env
```

`GET /api/health` reports `{ "mediaBackend": "r2" | "b2" }`.

R2 binding must **not** be present under `[env.staging]` while using B2. Wrangler validates every `[[r2_buckets]]` entry at deploy time and will call the R2 API even if `MEDIA_BACKEND=b2` — that fails with `Please enable R2` (code 10042) if R2 is off on the account. Keep local/dev R2 for Miniflare; staging uses B2 secrets only.

---

### Safe in git — `wrangler.toml` `[vars]` and bindings

| Item | Example | Why OK |
| --- | --- | --- |
| Environment label | `ENVIRONMENT = "staging"` | Not a credential |
| WebAuthn RP name / host / origin | `WEBAUTHN_RP_*` | Public browser config |
| Media backend selector | `MEDIA_BACKEND = "r2"` \| `"b2"` | Not a credential |
| D1 `database_id`, KV `id`, R2 `bucket_name` | UUIDs / names | Resource IDs, not keys |

Vars are **non-inheritable**: every `[env.*]` must declare its own `[env.*.vars]`.

### Never in git — Worker secrets

| Binding | Purpose | How to set |
| --- | --- | --- |
| `MASTER_KEY` | AES key material for BYOK AI key encryption | `wrangler secret put MASTER_KEY --env staging` |
| `YOUTUBE_API_KEY` | Optional YouTube Data API | `wrangler secret put YOUTUBE_API_KEY --env staging` |
| `B2_*` | Backblaze credentials when `MEDIA_BACKEND=b2` | `wrangler secret put B2_KEY_ID` (etc.) `--env staging` |

To your Worker code, secrets look like any other `env` binding (`c.env.MASTER_KEY`). Values are encrypted at rest and **write-only** in the dashboard / Wrangler.

### Worker secrets vs Secrets Store

- **Worker secrets** (`wrangler secret put`) — use this. Correct default for a single API Worker.
- **Secrets Store** (account-level) — skip until multiple Workers need the same secret with ACL.

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

1. Generate a new key and `wrangler secret put MASTER_KEY --env staging`.
2. Re-save any BYOK AI provider keys (ciphertext depends on `MASTER_KEY`).
3. Rotate git history only if a production-grade key was pushed.

---

## 2. Naming map (isolated per environment)

Never share D1 / R2 / KV / Workers across environments.

| Resource | Dev (local) | Staging (free CF) |
| --- | --- | --- |
| Worker (API) | `gymfolio-api-dev` | `gymfolio-api-staging` → `*.workers.dev` |
| D1 | `gymfolio-d1-dev` | `gymfolio-d1-staging` |
| R2 or Backblaze B2 | `gymfolio-media-dev` / local B2 | `MEDIA_BACKEND` + R2 bucket **or** B2 secrets |
| KV sessions | Miniflare placeholder | `gymfolio-sessions-staging` |
| Pages (web) | Vite `:5173` | `gymfolio-web-staging` → `*.pages.dev` |
| Public hostname | `localhost` | `gymfolio-web-staging.pages.dev` |

Wrangler default (no `--env`) = **dev**. Staging = `--env staging`.

---

## 3. Prerequisites

- Free Cloudflare account ([sign up](https://dash.cloudflare.com/sign-up))
- Node + pnpm
- `wrangler login` (or `CLOUDFLARE_API_TOKEN` in CI)
- **No** custom domain required

```bash
cd /path/to/Gymfolio
pnpm install
pnpm exec wrangler login
```

Enable **Workers** and **Pages** in the dashboard if prompted. Free tier includes Workers, Pages, D1, R2 (with limits), and KV.

---

## 4. One-time: create staging resources

From `apps/api`:

```bash
cd apps/api

pnpm exec wrangler d1 create gymfolio-d1-staging
pnpm exec wrangler kv namespace create gymfolio-sessions-staging
pnpm exec wrangler r2 bucket create gymfolio-media-staging
```

Paste the returned **database_id** and KV **id** into `[env.staging]` in [`apps/api/wrangler.toml`](../apps/api/wrangler.toml):

- `[[env.staging.d1_databases]]` → `database_id`
- `[[env.staging.kv_namespaces]]` → `id`

R2 only needs `bucket_name = "gymfolio-media-staging"` (already set). Commit those IDs — they are not secrets.

Confirm WebAuthn vars point at Pages:

```toml
WEBAUTHN_RP_ID = "gymfolio-web-staging.pages.dev"
WEBAUTHN_ORIGIN = "https://gymfolio-web-staging.pages.dev"
```

---

## 5. Set Worker secrets (staging)

```bash
cd apps/api

openssl rand -base64 48
pnpm exec wrangler secret put MASTER_KEY --env staging

# Optional
pnpm exec wrangler secret put YOUTUBE_API_KEY --env staging
```

Dashboard → Workers → `gymfolio-api-staging` → Settings → Variables and Secrets:

- **Variables**: `ENVIRONMENT`, `WEBAUTHN_*` (plaintext OK)
- **Secrets**: `MASTER_KEY` (encrypted / hidden)

---

## 6. Migrate staging D1

```bash
pnpm migrate:staging
# or: cd apps/api && pnpm exec wrangler d1 migrations apply gymfolio-d1-staging --remote --env staging
```

Never point this at a prod database. Seed media into staging R2 only when ready (large upload).

---

## 7. Deploy API (workers.dev)

```bash
pnpm deploy:staging:api
# → https://gymfolio-api-staging.<subdomain>.workers.dev
```

Smoke the Worker **directly** (bypasses Pages):

```bash
curl -sS "https://gymfolio-api-staging.<subdomain>.workers.dev/api/health"
# → {"ok":true}
```

Copy that origin (no trailing slash) — you need it for the Pages variable next.

---

## 8. Create Pages project + proxy env + deploy web

```bash
# Once
pnpm exec wrangler pages project create gymfolio-web-staging

# Set the proxy target (Pages → Worker). Use your real workers.dev URL from §7.
# Via dashboard: Workers & Pages → gymfolio-web-staging → Settings → Environment variables
#   Name:  GYMFOLIO_API_ORIGIN
#   Value: https://gymfolio-api-staging.<subdomain>.workers.dev
#   Scope: Production (and Preview if you use branch previews)
#
# Or CLI (wrangler pages secret / project settings vary by version) — dashboard is fine.
```

Build + deploy (includes [`functions/`](../apps/web/functions/) for `/api` proxy).
**Important:** deploy uses `--branch staging` (Pages production branch) so `gymfolio-web-staging.pages.dev` is updated.
Without that, Wrangler only publishes a hash preview URL and production `/api/*` serves SPA HTML.
If the project was created with production branch `main`, switch it to `staging` in the dashboard (or via API) once.

```bash
pnpm deploy:staging:web
```

Also set Pages env var **before or right after** deploy:

| Name | Value | Environment |
| --- | --- | --- |
| `GYMFOLIO_API_ORIGIN` | `https://gymfolio-api-staging.<subdomain>.workers.dev` | **Production** (and Preview if needed) |

Dashboard → Workers & Pages → `gymfolio-web-staging` → Settings → Variables.

Open: `https://gymfolio-web-staging.pages.dev`

SPA fallback: [`apps/web/public/_redirects`](../apps/web/public/_redirects).

### Verify proxy

```bash
curl -sS "https://gymfolio-web-staging.pages.dev/api/health"
# → {"ok":true}   (or Worker health JSON)

# HTML body = production deploy has no Functions (redeploy with pnpm deploy:staging:web)
# GYMFOLIO_API_ORIGIN error JSON = Functions work; set the Pages variable above
```

---

## 9. Self-deploy from a git branch

Staging is meant to track a branch you control (recommended: `staging` or `main`).

### A. Manual deploy from a branch (recommended first)

```bash
git fetch origin
git checkout staging          # or: git checkout main
git pull --ff-only

# One-time / when secrets or IDs change — skip on routine deploys
# pnpm migrate:staging

pnpm deploy:staging           # API Worker + Pages (build + functions)
```

Deploy only what changed:

```bash
pnpm deploy:staging:api       # Worker only
pnpm deploy:staging:web       # Pages only (build + functions)
```

Checklist before first push to a shared remote:

- [ ] `apps/api/.dev.vars` is **not** committed (gitignored)
- [ ] No `MASTER_KEY` in `wrangler.toml`
- [ ] Staging D1/KV IDs filled in `wrangler.toml` and committed

### B. Pages: Connect-to-Git (recommended for web)

Connect-to-Git only uploads the **build output directory**. A Vite-only build
ships SPA files and `/api/*` becomes HTML via `_redirects`. The fix is
[`pnpm pages:build`](../scripts/cf-pages-build.mjs): Vite build **plus** compile
`apps/web/functions` → `apps/web/dist/_worker.js` (+ `_routes.json`).

1. Dashboard → Workers & Pages → `gymfolio-web-staging` → **Settings** → **Builds**
   (or create via **Connect to Git**).
2. Connect the Gymfolio repo. Use:

| Setting | Value |
| --- | --- |
| Production branch | `staging` |
| Root directory | *(empty / repo root)* |
| Build command | `corepack enable && pnpm install && pnpm pages:build` |
| Build output directory | `apps/web/dist` |
| Deploy command | *(leave default / empty)* |

3. **Environment variables** (Pages → Settings → Variables) — Production **and** Preview:

| Name | Value |
| --- | --- |
| `GYMFOLIO_API_ORIGIN` | `https://gymfolio-api-staging.<your-subdomain>.workers.dev` |

4. After the first Connect-to-Git deploy, verify:

```bash
curl -sS https://gymfolio-web-staging.pages.dev/api/health
# expect JSON from the Worker (not <!doctype html>)
```

5. Optional: set `NODE_VERSION=22` under Pages build env if the builder needs it.

**Do not** use build command `pnpm --filter web build` alone — that omits `_worker.js`.

### C. API Worker (not deployed by Pages Git)

Pages Connect-to-Git does **not** deploy Workers. Use CLI or GitHub Actions:

```bash
pnpm staging:deploy:api
```

Workflow: [`.github/workflows/deploy-staging.yml`](../.github/workflows/deploy-staging.yml) deploys the API on push to `staging`. Keep Worker secrets out of Git (`pnpm staging:secrets`).

### D. Preview deployments (optional)

Pages can build every PR to a unique `*.pages.dev` preview URL. Preview WebAuthn will fail against production `WEBAUTHN_RP_ID` unless you add a separate preview Worker/env — skip previews for passkey testing; use the production Pages URL for staging QA.

---

## 10. Smoke checklist

- [ ] `GET https://gymfolio-api-staging.<subdomain>.workers.dev/api/health` → ok
- [ ] `GET https://gymfolio-web-staging.pages.dev/api/health` → ok (proxy)
- [ ] Open Pages URL → onboarding / register owner on empty D1
- [ ] Session cookie is `Secure` (`ENVIRONMENT !== "development"`)
- [ ] Password login works on `*.pages.dev`
- [ ] Register a passkey on the **Pages** origin (localhost passkeys will not work)
- [ ] Start / finish a workout; resume bar clears
- [ ] Exercise media loads from staging R2 (after seed)
- [ ] PWA name shows **Gymfolio**
- [ ] Dashboard: no plaintext `MASTER_KEY` under Worker Variables

---

## 11. Local after secrets hygiene

```bash
cd apps/api && cp .dev.vars.example .dev.vars   # if needed
pnpm db:migrate:local
pnpm seed:media -- --limit 20                   # optional
pnpm dev
```

---

## 12. CI split: Pages Git + Actions for API

| Surface | How it deploys |
| --- | --- |
| Web (Pages + `/api` proxy) | **Connect-to-Git** with `pnpm pages:build` → `apps/web/dist` includes `_worker.js` |
| API Worker | **GitHub Action** or `pnpm staging:deploy:api` |

### Pages (Connect-to-Git)

See §9B. Build must be `pnpm pages:build`, not Vite-only.

### API (GitHub Action)

[`.github/workflows/deploy-staging.yml`](../.github/workflows/deploy-staging.yml) on push to `staging`:

- `pnpm staging:deploy:api`
- Optional smoke via repo variable `WORKER_HEALTH_URL`

GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

One-time outside CI: `pnpm staging:secrets` + Pages var `GYMFOLIO_API_ORIGIN`.

---

## 13. Prod (later)

Mirror with `*-prod` names and `[env.production]`. Separate D1/R2/KV/`MASTER_KEY`. Free hostnames: `gymfolio-web-prod.pages.dev` + `gymfolio-api-prod.*.workers.dev`, or attach a custom domain.

---

## 14. Optional: custom domain (when you have one)

1. Add domain to Cloudflare DNS.
2. Pages → Custom domains → `staging.gymfolio.example.com`.
3. Uncomment Worker route in `wrangler.toml` for `staging.gymfolio.example.com/api/*`.
4. Update `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` to that host.
5. You can remove the Pages Function proxy once the Worker route owns `/api/*` on the same host.
