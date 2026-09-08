#!/usr/bin/env node
/**
 * Cloudflare Pages Connect-to-Git build for the web app.
 *
 * Connect-to-Git only publishes the build output directory. A plain Vite build
 * leaves /api/* without a Function (404 / SPA shell only).
 *
 * This script:
 *   1) builds the SPA into apps/web/dist
 *   2) compiles apps/web/functions → dist/_worker.js (+ _routes.json)
 *
 * Pages then receives a self-contained dist/ (Advanced Mode) that still proxies
 * /api/* via GYMFOLIO_API_ORIGIN.
 *
 * Usage (repo root — what Pages build command should run):
 *   pnpm pages:build
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const WEB = path.join(ROOT, "apps/web")
const API = path.join(ROOT, "apps/api")
const DIST = path.join(WEB, "dist")
const FUNCTIONS = path.join(WEB, "functions")
const FN_ENTRY = path.join(FUNCTIONS, "api/[[path]].ts")
const TMP = path.join(WEB, ".wrangler/pages-functions-out")

function wranglerBin() {
  const candidates = [
    path.join(API, "node_modules/.bin/wrangler"),
    path.join(ROOT, "node_modules/.bin/wrangler"),
    path.join(WEB, "node_modules/.bin/wrangler"),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: "inherit",
    ...opts,
  })
  if (res.status !== 0) {
    console.error(`Command failed (${res.status}): ${cmd} ${args.join(" ")}`)
    process.exit(res.status ?? 1)
  }
}

if (!fs.existsSync(FN_ENTRY)) {
  console.error(`Missing Pages Function source: ${FN_ENTRY}`)
  process.exit(1)
}

const wrangler = wranglerBin()
if (!wrangler) {
  console.error("wrangler not found — pnpm install from repo root first")
  process.exit(1)
}

console.log("→ Vite build (apps/web)…")
run("pnpm", ["--filter", "web", "build"], { cwd: ROOT })

if (!fs.existsSync(DIST)) {
  console.error(`Expected build output missing: ${DIST}`)
  process.exit(1)
}

console.log("→ Compile Pages Functions → dist/_worker.js…")
fs.rmSync(TMP, { recursive: true, force: true })
fs.mkdirSync(TMP, { recursive: true })
run(
  wrangler,
  [
    "pages",
    "functions",
    "build",
    FUNCTIONS,
    `--outdir=${TMP}`,
    `--output-routes-path=${path.join(TMP, "_routes.json")}`,
  ],
  { cwd: WEB },
)

const built = path.join(TMP, "index.js")
if (!fs.existsSync(built)) {
  console.error("functions build did not produce index.js")
  process.exit(1)
}

fs.copyFileSync(built, path.join(DIST, "_worker.js"))
fs.copyFileSync(path.join(TMP, "_routes.json"), path.join(DIST, "_routes.json"))
fs.writeFileSync(
  path.join(DIST, ".assetsignore"),
  ["_worker.js", "_worker.js.map", "_routes.json"].join("\n") + "\n",
)

// Prefer public/_routes.json include /api/* if present (already copied by Vite);
// ensure dist always has routes that invoke the worker for /api.
const routes = JSON.parse(fs.readFileSync(path.join(DIST, "_routes.json"), "utf8"))
console.log("→ _routes.json:", JSON.stringify(routes))
if (!JSON.stringify(routes).includes("/api")) {
  console.error("Compiled routes missing /api — aborting")
  process.exit(1)
}

const workerBytes = fs.statSync(path.join(DIST, "_worker.js")).size
console.log(`→ dist/_worker.js (${workerBytes} bytes) ready for Connect-to-Git`)

// # SPA shell for missing paths. Do NOT use public/_redirects `/* /index.html 200` —
// # Advanced Mode flags that as an infinite loop and ignores it.
const indexHtml = path.join(DIST, "index.html")
if (fs.existsSync(indexHtml)) {
  fs.copyFileSync(indexHtml, path.join(DIST, "404.html"))
  console.log("→ dist/404.html (= index.html) for SPA deep links")
}
const redirects = path.join(DIST, "_redirects")
if (fs.existsSync(redirects)) {
  const text = fs.readFileSync(redirects, "utf8")
  if (/^\s*\/\*\s+/m.test(text)) {
    console.warn("→ stripping SPA /* rewrite from dist/_redirects (CF infinite-loop rule)")
    fs.writeFileSync(
      redirects,
      text
        .split("\n")
        .filter((line) => !/^\s*\/\*\s+/.test(line))
        .join("\n"),
    )
  }
}

console.log("Done. Pages build output: apps/web/dist")
