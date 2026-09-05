import { defineConfig } from "@playwright/test"

/**
 * Full-app journey against the local Vite + Wrangler stack.
 * Prerequisites: `pnpm dev` (web :5173, api :8787).
 *
 *   pnpm test:e2e
 *
 * Report + screenshots land in e2e-output/ (gitignored).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 360_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["./e2e/reporters/journey-html-reporter.ts"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "off",
    video: "off",
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
  },
  outputDir: "e2e-output/test-results",
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
})
