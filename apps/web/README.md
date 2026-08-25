# Fitness Tracker — Web

The frontend for the self-hosted fitness tracker (shadcn/ui, "new-york" style, Tailwind v4).
Part of the monorepo at the repo root — see `../api` for the backend and
`../../fitness-tracker-architecture.md` for the full design.

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

## What's real vs. still fixture data

- **Real, backed by the API**: authentication, weight tracking, hydration, sleep, and macro
  logging — all persist through `src/lib/api-client.ts` to the Worker/D1 backend in `../api`.
- **Still fixture data** (`src/lib/stub-data.ts`): the exercise library, equipment profile,
  routine builder, and adherence history — these modules don't have a backend yet (see the
  architecture doc's §12 build order). Their shapes already mirror the eventual API contracts,
  so wiring each one up is a data-source swap, not a redesign.
- AI flows (equipment detection, routine generation) are simulated with timers, not a real
  model call, until the BYOK adapter (architecture §7) is built.

## Theming

Settings → Appearance is a real, shipped feature: light/dark/system, eight color presets, a
live corner-radius slider, and a font-pairing choice — all CSS-variable driven per architecture
§5, applied instantly, persisted to `localStorage`.
