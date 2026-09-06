#!/usr/bin/env node
/**
 * Interactive helper: put required staging Worker secrets from apps/api/.dev.vars
 * (or stdin). Does not print secret values.
 *
 *   pnpm staging:secrets
 */
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"

const ROOT = path.resolve(import.meta.dirname, "..")
const API_DIR = path.join(ROOT, "apps/api")
const DEV_VARS = path.join(API_DIR, ".dev.vars")

const REQUIRED = ["MASTER_KEY", "B2_KEY_ID", "B2_APPLICATION_KEY", "B2_BUCKET", "B2_ENDPOINT"]
const OPTIONAL = ["B2_REGION", "YOUTUBE_API_KEY"]

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

function putSecret(name, value) {
  const res = spawnSync("pnpm", ["exec", "wrangler", "secret", "put", name, "--env", "staging"], {
    cwd: API_DIR,
    input: value,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
  })
  if (res.status !== 0) {
    throw new Error(`wrangler secret put ${name} failed (exit ${res.status})`)
  }
}

async function main() {
  const vars = loadDevVars()
  const rl = readline.createInterface({ input, output })
  console.log("Staging Worker secrets → gymfolio-api-staging")
  console.log(`Reading optional defaults from ${DEV_VARS} (if present).\n`)

  for (const name of [...REQUIRED, ...OPTIONAL]) {
    const optional = OPTIONAL.includes(name)
    let value = vars[name]?.trim() ?? ""
    if (!value) {
      const prompt = optional
        ? `${name} (optional, Enter to skip): `
        : `${name} (required): `
      value = (await rl.question(prompt)).trim()
    } else {
      console.log(`${name}: using value from .dev.vars`)
    }
    if (!value) {
      if (optional) continue
      throw new Error(`${name} is required`)
    }
    putSecret(name, value)
  }

  rl.close()
  console.log("\nDone. Verify in dashboard → Workers → gymfolio-api-staging → Settings → Variables.")
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
