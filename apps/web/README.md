# Gymfolio — Web

The frontend for Gymfolio (shadcn/ui, "new-york" style, Tailwind v4).
Part of the monorepo at the repo root — see `../api` for the backend and
`../../docs/STAGING.md` for staging infrastructure naming.

## Run it

From the repo root (not this directory) so the API dev server comes up alongside it:

```bash
pnpm install
pnpm dev
```

Or just this app on its own, against whatever API it's pointed at via the `/api` dev-server
proxy in `vite.config.ts`:

```bash
pnpm --filter web dev
```

## What's real vs. still fixture / deferred

- **Real, backed by the API**: authentication (password + passkeys), family invites/members,
  weight / hydration / sleep / macros, user settings & equipment, routines, **workout set
  logging**, adherence & recent sessions, exercise library (seeded D1), account sessions &
  password change, BYOK AI config (encrypted server-side).
- **Client constants only** (`src/lib/stub-data.ts`): split presets, schedule helpers,
  equipment labels, AI provider *labels* — not fake user data.
- **Partial / deferred**:
  - Exercise media: run `pnpm seed:media` from repo root to load free-exercise-db photos into
    local R2 + D1 (~870 exercises). WebP thumb + stills served from
    `/api/media/exercises/:id/thumb.webp`, `/start.webp`, and `/end.webp` (JPEG fallback if
    present). Preview presets with `pnpm preview:gifs`. See root `ATTRIBUTION.md`.
  - YouTube lazy-fetch: `POST /api/exercises/:id/youtube` on detail open when `YOUTUBE_API_KEY`
    is set on the worker; quota tracked in KV.
  - AI detect/generate: real config + degrade path; vision/LLM vendor calls are still
    heuristic until a full provider adapter is plugged in.
  - Appearance theme: localStorage only (by design for v0).
- PWA: `vite-plugin-pwa` precaches the app shell, network-first caches `/api/exercises`,
  network-only for other `/api` writes, cache-first for exercise GIFs.

## Theming

Settings → Appearance is a real, shipped feature: light/dark/system, eight color presets, a
live corner-radius slider, and a font-pairing choice — all CSS-variable driven per architecture
§5, applied instantly, persisted to `localStorage`.
