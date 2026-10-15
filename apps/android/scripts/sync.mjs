import { copyFileSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const www = join(root, "www")
mkdirSync(www, { recursive: true })
writeFileSync(
  join(www, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Gymfolio</title>
<p>Gymfolio Capacitor shell — content loads from capacitor.config server URL.</p>`,
)

const merge = spawnSync(process.execPath, [join(root, "scripts/merge-native.mjs")], {
  cwd: root,
  stdio: "inherit",
})
if ((merge.status ?? 1) !== 0) process.exit(merge.status ?? 1)

const cap = spawnSync("npx", ["cap", "sync", "android"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
})
process.exit(cap.status ?? 1)
