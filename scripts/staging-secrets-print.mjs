#!/usr/bin/env node
/**
 * Shows staging Worker secret *names* (Cloudflare never returns values)
 * and prints matching values from apps/api/.dev.vars (local source of truth).
 *
 *   pnpm staging:secrets:print
 */
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const ROOT = path.resolve(import.meta.dirname, "..")
const API_DIR = path.join(ROOT, "apps/api")
const DEV_VARS = path.join(API_DIR, ".dev.vars")

const EXPECTED = [
  "MASTER_KEY",
  "B2_KEY_ID",
  "B2_APPLICATION_KEY",
  "B2_BUCKET",
  "B2_ENDPOINT",
  "B2_REGION",
  "YOUTUBE_API_KEY",
]

function loadDevVars() {
  /** @type {Record<string, string>} */
  const out = {}
  if (!fs.existsSync(DEV_VARS)) return out
  for (const line of fs.readFileSync(DEV_VARS, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq < 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function listRemoteSecretNames() {
  const res = spawnSync(
    "pnpm",
    ["exec", "wrangler", "secret", "list", "--env", "staging"],
    { cwd: API_DIR, encoding: "utf8" },
  )
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || "").trim()
    throw new Error(err || `wrangler secret list failed (exit ${res.status})`)
  }
  const raw = (res.stdout || "").trim()
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((s) => (typeof s === "string" ? s : s.name)).filter(Boolean)
    }
  } catch {
    // fall through — table / line output
  }
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("┌") && !l.startsWith("├") && !l.startsWith("└") && !l.includes("Name"))
    .map((l) => l.replace(/^[│|]\s*/, "").split(/\s+/)[0])
    .filter((n) => n && n !== "─")
}

function main() {
  const local = loadDevVars()
  /** @type {string[]} */
  let remote = []
  try {
    remote = listRemoteSecretNames()
  } catch (e) {
    console.error(`Could not list staging secrets: ${e.message || e}`)
    console.error("(Need wrangler login + staging Worker deployed.)\n")
  }

  console.log("Cloudflare Worker secrets are write-only — values cannot be read back.")
  console.log("Below: names on staging + values from local apps/api/.dev.vars\n")

  console.log("On staging (names only):")
  if (remote.length === 0) {
    console.log("  (none / unavailable)")
  } else {
    for (const name of remote) console.log(`  ✓ ${name}`)
  }

  console.log("\nLocal .dev.vars values:")
  if (!fs.existsSync(DEV_VARS)) {
    console.log(`  (missing ${DEV_VARS})`)
  } else {
    const keys = [...new Set([...EXPECTED, ...Object.keys(local)])]
    for (const name of keys) {
      const onStaging = remote.includes(name) ? "staging✓" : "staging✗"
      const val = local[name]
      if (val === undefined) {
        console.log(`  ${name}: (not in .dev.vars)  [${onStaging}]`)
      } else {
        console.log(`  ${name}=${val}  [${onStaging}]`)
      }
    }
  }
}

main()
