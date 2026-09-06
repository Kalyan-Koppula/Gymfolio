#!/usr/bin/env node
/**
 * Build + deploy gymfolio-web-staging to the *production* Pages alias.
 *
 * Must run with cwd = apps/web so Wrangler picks up sibling `functions/`.
 * Must pass --branch main (project production branch) so gymfolio-web-staging.pages.dev updates
 * (otherwise you only get a hash preview URL and /api falls through to SPA HTML).
 *
 *   pnpm staging:deploy:web
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const WEB = path.join(ROOT, "apps/web")
const API = path.join(ROOT, "apps/api")
const FN = path.join(WEB, "functions/api/[[path]].ts")
const WRANGLER = path.join(API, "node_modules/.bin/wrangler")
const PROJECT = "gymfolio-web-staging"
const PROD_BRANCH = "main"

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...opts })
  if (res.status !== 0) process.exit(res.status ?? 1)
}

if (!fs.existsSync(FN)) {
  console.error(`Missing Pages Function: ${FN}`)
  process.exit(1)
}
if (!fs.existsSync(WRANGLER)) {
  console.error(`Missing wrangler at ${WRANGLER} — run pnpm install`)
  process.exit(1)
}

console.log("Building web…")
run("pnpm", ["--filter", "web", "build"], { cwd: ROOT })

console.log(`\nDeploying Pages → ${PROJECT} (branch=${PROD_BRANCH}, with functions/)…`)
run(
  WRANGLER,
  [
    "pages",
    "deploy",
    "dist",
    `--project-name=${PROJECT}`,
    `--branch=${PROD_BRANCH}`,
    "--commit-dirty=true",
  ],
  { cwd: WEB },
)

console.log(`
Production: https://${PROJECT}.pages.dev/api/health

If you get GYMFOLIO_API_ORIGIN JSON error, set Pages env var (Production):
  Dashboard → Workers & Pages → ${PROJECT} → Settings → Variables
  GYMFOLIO_API_ORIGIN = https://gymfolio-api-staging.<subdomain>.workers.dev
`)
