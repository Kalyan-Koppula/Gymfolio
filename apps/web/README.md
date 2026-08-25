# Fitness Tracker — Design Validation Prototype

A clickable prototype for the v0 fitness tracker, built from the real component set (shadcn/ui,
"new-york" style, Tailwind v4) rather than a static mockup — every screen listed in the design
brief is here, wired with stub data, so the interaction and state behavior can be reviewed before
the real backend is built.

## Run it

```bash
npm install
npm run dev
```

Open the printed localhost URL. Resize the browser to ~390px wide (or use device emulation) — this
is a mobile-first design, baseline canvas 390px.

## How to review

- **Start at `/`** — a design index linking to every screen, grouped by IA (Today / Train / Log /
  Progress / Settings), plus a dark-mode toggle and color-preset switcher for quick spot checks.
- **The flask icon** in every screen's header opens the **prototype simulator** — toggles for
  states that need a real backend to occur naturally: offline / online, AI provider configured or
  not, YouTube quota near its cap, and whether an active routine exists. It also has a full jump
  list to every screen.
- **Theme system**: Settings → Appearance exposes the same runtime CSS-variable controls the real
  app will ship (light/dark/system, three color presets, a live corner-radius slider, and a
  sans-only vs. sans+serif font pairing) — every control applies instantly, no reload.
- **Write states**: any screen with a save/log/quick-add action routes through the same
  saving → success / failed-with-retry pattern (see the simulator's "Network connection" toggle to
  force a failure — note the input is never cleared on failure, per the design brief's §1.9).

## What's stubbed vs. real

- All data (`src/lib/stub-data.ts`) is in-memory fixture data — no backend, no persistence beyond
  `localStorage` for the theme preference itself.
- "AI" flows (equipment detection, routine generation) are simulated with timers, not a real model
  call — they exist to validate the *loading → review → editable result* UX shape.
- Exercise GIFs/photos are placeholder tiles (`ExerciseThumb`), not real media — the fallback
  static-image state is designed explicitly rather than left as a broken-image icon.

## Known follow-ups before this becomes production code

- The production build is one JS chunk (~284KB gzipped) — fine for a design prototype, but the
  real build should route-split (React.lazy per tab) per NFR-3's budget-device guidance.
- Only Zinc (default) and two alternate presets (Rose, Violet) are implemented — enough to prove
  the token architecture holds up under a palette swap, per the design brief's checklist.
