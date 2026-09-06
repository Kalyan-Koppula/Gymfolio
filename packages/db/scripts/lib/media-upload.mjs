/**
 * Upload helpers for seed-media — Cloudflare R2 (wrangler) or Backblaze B2 (S3 API).
 *
 * Backend from (first match):
 *   1. --backend r2|b2 CLI flag
 *   2. MEDIA_BACKEND env / apps/api/.dev.vars
 *   3. default "r2"
 */
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

const require = createRequire(import.meta.url)

/**
 * @param {string} apiDir
 * @param {string[]} argv
 */
export function resolveMediaBackend(apiDir, argv = process.argv) {
  const flagIdx = argv.indexOf("--backend")
  if (flagIdx >= 0 && argv[flagIdx + 1]) {
    const v = String(argv[flagIdx + 1]).toLowerCase()
    if (v === "b2" || v === "r2") return v
  }
  const fromEnv = process.env.MEDIA_BACKEND?.trim().toLowerCase()
  if (fromEnv === "b2" || fromEnv === "r2") return fromEnv

  const devVars = path.join(apiDir, ".dev.vars")
  if (fs.existsSync(devVars)) {
    for (const line of fs.readFileSync(devVars, "utf8").split("\n")) {
      const m = line.match(/^\s*MEDIA_BACKEND\s*=\s*(.+?)\s*$/)
      if (m) {
        const v = m[1].replace(/^["']|["']$/g, "").toLowerCase()
        if (v === "b2" || v === "r2") return v
      }
    }
  }
  return "r2"
}

/**
 * Load KEY=VALUE from apps/api/.dev.vars into a map (does not override existing process.env).
 * @param {string} apiDir
 */
export function loadDevVars(apiDir) {
  /** @type {Record<string, string>} */
  const out = {}
  const devVars = path.join(apiDir, ".dev.vars")
  if (!fs.existsSync(devVars)) return out
  for (const line of fs.readFileSync(devVars, "utf8").split("\n")) {
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

/**
 * @param {string} apiDir
 * @param {string} r2Bucket
 * @param {{ key: string, filePath: string }[]} tasks
 * @param {(cmd: string) => void} wrangler
 * @param {boolean} [remote]
 */
export function uploadToR2(apiDir, r2Bucket, tasks, wrangler, remote = false) {
  if (tasks.length === 0) return
  const mapPath = path.join(apiDir, "../../.cache/free-exercise-db/r2-bulk-upload.json")
  fs.mkdirSync(path.dirname(mapPath), { recursive: true })
  const entries = tasks.map((t) => ({ key: t.key, file: t.filePath }))
  fs.writeFileSync(mapPath, JSON.stringify(entries))
  const scope = remote ? "--remote" : "--local"
  console.log(`Bulk uploading ${tasks.length} objects via wrangler r2 bulk put → ${r2Bucket} (${remote ? "remote" : "local"})…`)
  wrangler(
    `r2 bulk put ${r2Bucket} --filename=${mapPath} ${scope} --content-type image/webp --concurrency 50 -y`,
  )
}

/**
 * Resolve aws4fetch from the api package (workspace dependency).
 * @param {string} apiDir
 */
async function loadAwsClient(apiDir) {
  try {
    const pkg = path.join(apiDir, "node_modules/aws4fetch/dist/aws4fetch.esm.mjs")
    if (fs.existsSync(pkg)) {
      return import(pathToFileURL(pkg).href)
    }
  } catch {
    /* fall through */
  }
  // pnpm nested store
  try {
    const resolved = require.resolve("aws4fetch", { paths: [apiDir] })
    return import(pathToFileURL(resolved).href)
  } catch {
    throw new Error(
      "aws4fetch not found — run `pnpm install` from the repo root (api depends on aws4fetch).",
    )
  }
}

/** Accept host-only or full URL; aws4fetch requires an absolute URL. */
function normalizeB2Endpoint(raw) {
  let endpoint = String(raw ?? "")
    .trim()
    .replace(/\/$/, "")
  if (!endpoint) return ""
  if (!/^https?:\/\//i.test(endpoint)) endpoint = `https://${endpoint}`
  return endpoint
}

/**
 * @param {string} apiDir
 * @param {{ key: string, filePath: string }[]} tasks
 * @param {number} [concurrency]
 */
export async function uploadToB2(apiDir, tasks, concurrency = 8) {
  if (tasks.length === 0) return
  const vars = { ...loadDevVars(apiDir), ...process.env }
  const keyId = vars.B2_KEY_ID?.trim()
  const appKey = vars.B2_APPLICATION_KEY?.trim()
  const bucket = vars.B2_BUCKET?.trim()
  const endpoint = normalizeB2Endpoint(vars.B2_ENDPOINT)
  let region = vars.B2_REGION?.trim()
  if (!region && endpoint) {
    const m = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i)
    region = m?.[1] ?? "us-west-004"
  }
  if (!keyId || !appKey || !bucket || !endpoint) {
    throw new Error(
      "B2 upload needs B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET, B2_ENDPOINT in apps/api/.dev.vars or the environment",
    )
  }

  const { AwsClient } = await loadAwsClient(apiDir)
  const client = new AwsClient({
    accessKeyId: keyId,
    secretAccessKey: appKey,
    service: "s3",
    region,
  })

  console.log(`Uploading ${tasks.length} objects to Backblaze B2 bucket ${bucket}…`)
  let i = 0
  async function worker() {
    while (i < tasks.length) {
      const idx = i++
      const t = tasks[idx]
      const url = `${endpoint}/${bucket}/${t.key.split("/").map(encodeURIComponent).join("/")}`
      const body = fs.readFileSync(t.filePath)
      const res = await client.fetch(url, {
        method: "PUT",
        body,
        headers: { "Content-Type": "image/webp" },
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(`B2 PUT ${t.key} failed: ${res.status} ${text.slice(0, 200)}`)
      }
      if ((idx + 1) % 50 === 0 || idx + 1 === tasks.length) {
        console.log(`  B2 upload ${idx + 1}/${tasks.length}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()))
}

/**
 * @param {{
 *   backend: "r2" | "b2"
 *   apiDir: string
 *   r2Bucket: string
 *   tasks: { key: string, filePath: string }[]
 *   wrangler: (cmd: string) => void
 *   remote?: boolean
 * }} opts
 */
export async function uploadMediaObjects(opts) {
  if (opts.backend === "b2") {
    await uploadToB2(opts.apiDir, opts.tasks)
  } else {
    uploadToR2(opts.apiDir, opts.r2Bucket, opts.tasks, opts.wrangler, opts.remote === true)
  }
}
