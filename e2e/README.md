# End-to-end journey (Playwright)

Walks a freshly registered owner through onboarding and every primary screen/action, capturing screenshots into an HTML report.

## Prerequisites

1. Local stack running:
   ```bash
   pnpm dev
   ```
   (web on `:5173`, API on `:8787`)

2. Chromium installed (once):
   ```bash
   pnpm exec playwright install chromium
   ```

## Run

```bash
pnpm test:e2e
```

This will:

1. Clear local D1 **user** data (keeps the exercise catalog)
2. Register a new owner and complete onboarding
3. Build a PPL routine, train, log metrics, visit Progress + Settings
4. Write screenshots + report to **`e2e-output/journey/index.html`**

Open the report:

```bash
open e2e-output/journey/index.html
```

## Notes

- Registration only works when no account exists — the reset step makes that true for local D1.
- Mobile viewport (390×844) so screenshots match the phone UI.
- Passkeys are skipped (password path only).
