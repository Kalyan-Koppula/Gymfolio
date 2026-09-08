#!/usr/bin/env node
/**
 * Build + deploy gymfolio-web-staging (CLI / local).
 * Uses the same `pnpm pages:build` as Cloudflare Connect-to-Git so dist/
 * always contains _worker.js for /api/*.
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
const WRANGLER = path.join(API, "node_modules/.bin/wrangler")
const PROJECT = "gymfolio-web-staging"
const PROD_BRANCH = "staging"
const WORKER_JS = path.join(WEB, "dist/_worker.js")

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: "utf8", ...opts })
  if (opts.stdio !== "inherit" && (res.stdout || res.stderr)) {
    process.stdout.write(res.stdout || "")
    process.stderr.write(res.stderr || "")
  }
  if (res.status !== 0) process.exit(res.status ?? 1)
  return res
}

if (!fs.existsSync(WRANGLER)) {
  console.error(`Missing wrangler at ${WRANGLER} — run pnpm install`)
  process.exit(1)
}

console.log("1/3 pages:build (SPA + _worker.js)…")
run("pnpm", ["pages:build"], { cwd: ROOT, stdio: "inherit" })

if (!fs.existsSync(WORKER_JS)) {
  console.error(`Missing ${WORKER_JS} after pages:build — aborting`)
  process.exit(1)
}

console.log(`\n2/3 Deploying Pages → ${PROJECT} (branch=${PROD_BRANCH})…`)
const deploy = run(
  WRANGLER,
  [
    "pages",
    "deploy",
    "dist",
    `--project-name=${PROJECT}`,
    `--branch=${PROD_BRANCH}`,
    "--commit-dirty=true",
  ],
  { cwd: WEB, stdio: "pipe" },
)
const deployOut = `${deploy.stdout || ""}${deploy.stderr || ""}`
process.stdout.write(deployOut)

console.log(`\n3/3 Verify /api/health…`)
const urlMatch = deployOut.match(/https:\/\/[a-z0-9]+\.gymfolio-web-staging\.pages\.dev/)
const targets = [
  urlMatch?.[0] ? `${urlMatch[0]}/api/health` : null,
  `https://${PROJECT}.pages.dev/api/health`,
].filter(Boolean)

let failed = false
for (const url of targets) {
  const curl = spawnSync("curl", ["-sS", "-L", "--max-time", "30", url], {
    encoding: "utf8",
  })
  const body = (curl.stdout || "").trim()
  const isHtml = /^<!doctype/i.test(body) || /^<html/i.test(body)
  console.log(`\n${url}`)
  if (isHtml) {
    failed = true
    console.error(`  FAIL → SPA HTML`)
  } else {
    console.log(`  OK → ${body.slice(0, 180)}`)
  }
}

console.log(`
Pages vars (Production + Preview):
  GYMFOLIO_API_ORIGIN=https://gymfolio-api-staging.<subdomain>.workers.dev
  VITE_MEDIA_ORIGIN=https://gymfolio-api-staging.<subdomain>.workers.dev
  (VITE_* must be set as a *build* variable so media bypasses the Pages /api proxy)
`)

if (failed) process.exit(1)
