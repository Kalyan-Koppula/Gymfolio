#!/usr/bin/env node
/**
 * Wipe user-scoped local D1 tables so the journey can register a fresh owner.
 * Keeps shared `exercises` rows intact.
 *
 *   node e2e/helpers/reset-local-db.mjs
 */
import { execSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const API = path.join(ROOT, "apps/api")

const STATEMENTS = [
  "DELETE FROM workout_log_sets;",
  "DELETE FROM workout_logs;",
  "DELETE FROM routines;",
  "DELETE FROM theme_preferences;",
  "DELETE FROM user_settings;",
  "DELETE FROM body_metric_entries;",
  "DELETE FROM hydration_entries;",
  "DELETE FROM sleep_entries;",
  "DELETE FROM macro_entries;",
  "DELETE FROM credentials;",
  "DELETE FROM sessions;",
  "DELETE FROM invites;",
  "DELETE FROM ai_provider_configs;",
  "DELETE FROM users;",
  // Keep default tenant row if present; register will recreate if missing.
]

const sql = STATEMENTS.join("\n")
const tmp = path.join(ROOT, "e2e-output", "reset.sql")

import fs from "node:fs"
fs.mkdirSync(path.dirname(tmp), { recursive: true })
fs.writeFileSync(tmp, sql)

try {
  execSync(`pnpm exec wrangler d1 execute fitness-tracker --local --file=${tmp}`, {
    cwd: API,
    stdio: "inherit",
  })
  console.log("Local D1 user data cleared (exercises kept).")
} catch (err) {
  console.error("Failed to reset local D1 — is the API project set up?", err.message)
  process.exit(1)
}
