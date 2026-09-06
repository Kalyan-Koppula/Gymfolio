#!/usr/bin/env node
/**
 * Seeds free-exercise-db metadata into D1, gym photos + thumbs into object storage
 * (Cloudflare R2 or Backblaze B2), and remaps legacy ex-N exercise IDs.
 *
 * Usage (from repo root):
 *   pnpm seed:media              # full catalog (~873 exercises)
 *   pnpm seed:media -- --limit 20  # smoke subset
 *   pnpm seed:media -- --media-only   # regenerate WebP thumb + stills only
 *   pnpm seed:media -- --upload-only  # upload cached WebPs (no re-encode)
 *   pnpm seed:media -- --backend b2   # upload to Backblaze B2 instead of R2
 *   pnpm seed:media -- --staging      # remote staging D1 + B2 (prefer: pnpm seed:staging)
 *   pnpm seed:media -- --d1-only      # catalog → D1 only (uses local .cache/.../out thumbs; no B2)
 *   pnpm seed:media -- --skip-upload  # skip object storage upload
 *   pnpm preview:gifs                 # local WebP quality comparison (no upload)
 */
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import {
  fedbIdToSlug,
  mapMuscles,
  mapEquipment,
  mapDifficulty,
  sqlString,
  LEGACY_STUB_MAP,
} from "./lib/fedb-map.mjs"
import { buildExerciseMedia } from "./lib/seed-exercise-media.mjs"
import { thumbR2Key } from "./lib/media-build.mjs"
import { resolveMediaBackend, uploadMediaObjects } from "./lib/media-upload.mjs"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const CACHE = path.join(ROOT, ".cache/free-exercise-db")
const FEDB_JSON = path.join(CACHE, "exercises.json")
const FEDB_IMAGES = path.join(CACHE, "images")
const API_DIR = path.join(ROOT, "apps/api")
const R2_BUCKET_LOCAL = "gymfolio-media-dev"
const R2_BUCKET_STAGING = "gymfolio-media-staging"
const FEDB_RAW =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"
const FEDB_DIST =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"

const args = process.argv.slice(2).filter((a) => a !== "--")
const limitIdx = args.indexOf("--limit")
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : null
const SKIP_UPLOAD = args.includes("--skip-upload") || args.includes("--skip-r2")
const SKIP_IMAGES = args.includes("--skip-images")
const MEDIA_ONLY = args.includes("--media-only") || args.includes("--thumbs-only") || args.includes("--gifs-only")
const UPLOAD_ONLY = args.includes("--upload-only")
const D1_ONLY = args.includes("--d1-only") || args.includes("--catalog-only")
const STAGING = args.includes("--staging") || args.includes("--remote")

// Staging defaults to B2 (matches wrangler [env.staging]); override with --backend.
const MEDIA_BACKEND = (() => {
  if (process.argv.includes("--backend")) return resolveMediaBackend(API_DIR, process.argv)
  if (STAGING) return "b2"
  return resolveMediaBackend(API_DIR, process.argv)
})()

const D1_NAME = STAGING ? "gymfolio-d1-staging" : "gymfolio-d1-dev"
const D1_FLAGS = STAGING ? "--remote --env staging" : "--local"
const R2_BUCKET = STAGING ? R2_BUCKET_STAGING : R2_BUCKET_LOCAL

function wrangler(cmd, opts = {}) {
  execSync(`pnpm exec wrangler ${cmd}`, {
    cwd: API_DIR,
    stdio: opts.quiet ? "pipe" : "inherit",
    encoding: "utf8",
  })
}

function wranglerOut(cmd) {
  return execSync(`pnpm exec wrangler ${cmd}`, {
    cwd: API_DIR,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
  }).trim()
}

async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  if (fs.existsSync(dest)) return
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`)
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

async function ensureFedbJson() {
  fs.mkdirSync(CACHE, { recursive: true })
  if (!fs.existsSync(FEDB_JSON)) {
    console.log("Downloading free-exercise-db catalog…")
    await download(FEDB_DIST, FEDB_JSON)
  }
}

async function loadImage(relativePath) {
  const local = path.join(FEDB_IMAGES, relativePath)
  await download(`${FEDB_RAW}/${relativePath}`, local)
  return fs.readFileSync(local)
}

async function putMediaPool(tasks) {
  await uploadMediaObjects({
    backend: MEDIA_BACKEND,
    apiDir: API_DIR,
    r2Bucket: R2_BUCKET,
    tasks,
    wrangler,
    remote: STAGING,
  })
}

function sleepMs(ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    /* sync backoff between D1 remote bookings */
  }
}

function d1Exec(sql, { label = "SQL" } = {}) {
  const bytes = Buffer.byteLength(sql, "utf8")
  if (bytes > 95_000) {
    throw new Error(
      `D1 batch too large (${bytes} bytes, label=${label}). Split into smaller batches.`,
    )
  }
  // Remote D1 uses a booking queue; large/multiline files often sit on
  // "you can safely retry" forever. Keep statements small + add --yes.
  // Unique file per attempt so Wrangler does not reprocess a stale upload.
  const maxAttempts = STAGING ? 4 : 1
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const tmp = path.join(
      CACHE,
      `seed-batch-${Date.now()}-${process.pid}-${attempt}.sql`,
    )
    fs.writeFileSync(tmp, sql)
    try {
      if (STAGING) {
        console.log(
          `  D1 ${label} (${bytes} B)${attempt > 1 ? ` attempt ${attempt}/${maxAttempts}` : ""}…`,
        )
      }
      wrangler(`d1 execute ${D1_NAME} ${D1_FLAGS} --yes --file=${tmp}`)
      try {
        fs.unlinkSync(tmp)
      } catch {
        /* ignore */
      }
      return
    } catch (err) {
      lastErr = err
      try {
        fs.unlinkSync(tmp)
      } catch {
        /* ignore */
      }
      if (attempt === maxAttempts) break
      const waitMs = attempt * 2000
      console.warn(
        `  D1 ${label} failed (${String(err.message ?? err).slice(0, 120)}); retrying in ${waitMs}ms…`,
      )
      sleepMs(waitMs)
    }
  }
  throw lastErr
}

function d1Query(sql) {
  return JSON.parse(wranglerOut(`d1 execute ${D1_NAME} ${D1_FLAGS} --command=${JSON.stringify(sql)} --json`))
}

async function processExercise(ex) {
  const slug = fedbIdToSlug(ex.id)
  const muscles = mapMuscles(ex.primaryMuscles, ex.secondaryMuscles)
  const equipment = mapEquipment(ex.equipment, ex.name)
  const difficulty = mapDifficulty(ex.level)
  const instructions = (ex.instructions ?? []).join("\n\n")
  const images = ex.images ?? []

  let hasGif = 0
  let gifR2Key = null
  const tmpDir = path.join(CACHE, "out", slug)
  fs.mkdirSync(tmpDir, { recursive: true })
  const uploads = []

  if (!SKIP_IMAGES && images.length > 0) {
    try {
      const startBuf = await loadImage(images[0])
      const endBuf = images[1] ? await loadImage(images[1]) : null
      const built = buildExerciseMedia(startBuf, endBuf, tmpDir, slug, { skipR2: SKIP_UPLOAD })
      uploads.push(...built.uploads)
      hasGif = built.hasGif
      gifR2Key = built.gifR2Key
    } catch (err) {
      console.warn(`  ⚠ media skipped for ${slug}: ${err.message}`)
    }
  }

  return {
    id: slug,
    name: ex.name,
    muscleGroupsJson: JSON.stringify(muscles),
    equipmentJson: JSON.stringify(equipment),
    difficulty,
    instructions,
    hasGif,
    gifR2Key,
    uploads,
  }
}

function buildInsertBatch(rows) {
  const values = rows
    .map(
      (r) =>
        `(${sqlString(r.id)}, ${sqlString(r.name)}, ${sqlString(r.muscleGroupsJson)}, ${sqlString(r.equipmentJson)}, ${sqlString(r.difficulty)}, ${sqlString(r.instructions)}, ${r.hasGif}, ${r.gifR2Key ? sqlString(r.gifR2Key) : "NULL"}, 'not_fetched', NULL)`,
    )
    .join(",")
  // OR REPLACE so retries / partial prior runs do not hit UNIQUE on exercises.id
  return `INSERT OR REPLACE INTO exercises (id, name, muscle_groups_json, equipment_json, difficulty, instructions, has_gif, gif_r2_key, youtube_status, youtube_json) VALUES ${values};`
}

/** Build D1 rows from catalog JSON + local out/{slug}/thumb.webp (no re-encode / no B2). */
function rowsFromLocalCache(list) {
  const outRoot = path.join(CACHE, "out")
  const rows = []
  let withThumb = 0
  for (const ex of list) {
    const slug = fedbIdToSlug(ex.id)
    const thumbPath = path.join(outRoot, slug, "thumb.webp")
    const hasGif = fs.existsSync(thumbPath) ? 1 : 0
    if (hasGif) withThumb++
    rows.push({
      id: slug,
      name: ex.name,
      muscleGroupsJson: JSON.stringify(mapMuscles(ex.primaryMuscles, ex.secondaryMuscles)),
      equipmentJson: JSON.stringify(mapEquipment(ex.equipment, ex.name)),
      difficulty: mapDifficulty(ex.level),
      instructions: (ex.instructions ?? []).join("\n\n"),
      hasGif,
      gifR2Key: hasGif ? thumbR2Key(slug) : null,
    })
  }
  console.log(`D1-only: ${rows.length} exercises, ${withThumb} with local thumb.webp`)
  return rows
}

function writeD1Catalog(rows) {
  console.log("Writing D1 catalog…")
  d1Exec("DELETE FROM exercises;", { label: "delete exercises" })
  // Pack by row count and ~80KB so larger staging batches stay under D1 file limits.
  const TARGET = STAGING ? 30 : 40
  const MAX_BYTES = 80_000
  const batches = []
  let cur = []
  for (const row of rows) {
    const next = [...cur, row]
    const nextSql = buildInsertBatch(next)
    if (
      cur.length > 0 &&
      (cur.length >= TARGET || Buffer.byteLength(nextSql, "utf8") > MAX_BYTES)
    ) {
      batches.push(cur)
      cur = [row]
      continue
    }
    cur = next
  }
  if (cur.length) batches.push(cur)

  console.log(`  ${rows.length} rows → ${batches.length} insert batches (target ${TARGET}/batch)`)
  for (let i = 0; i < batches.length; i++) {
    d1Exec(buildInsertBatch(batches[i]), {
      label: `insert ${i + 1}/${batches.length}`,
    })
  }
}

function remapLegacyIds() {
  const legacyRemap = {}
  for (const [oldId, fedbId] of Object.entries(LEGACY_STUB_MAP)) {
    legacyRemap[oldId] = fedbIdToSlug(fedbId)
  }

  const routines = d1Query("SELECT user_id, days_json FROM routines")
  for (const row of routines[0]?.results ?? []) {
    const days = JSON.parse(row.days_json)
    let changed = false
    for (const day of days) {
      for (const ex of day.exercises ?? []) {
        if (legacyRemap[ex.exerciseId]) {
          ex.exerciseId = legacyRemap[ex.exerciseId]
          changed = true
        }
      }
    }
    if (changed) {
      d1Exec(
        `UPDATE routines SET days_json = ${sqlString(JSON.stringify(days))} WHERE user_id = ${sqlString(row.user_id)};`,
      )
    }
  }

  for (const [oldId, newId] of Object.entries(legacyRemap)) {
    d1Exec(`UPDATE workout_log_sets SET exercise_id = ${sqlString(newId)} WHERE exercise_id = ${sqlString(oldId)};`)
  }

  console.log("Legacy ex-N IDs remapped in routines and workout logs.")
}

async function main() {
  console.log(
    `Exercise media seed (target=${STAGING ? "staging" : "local"}, d1=${D1_NAME}, backend=${MEDIA_BACKEND})`,
  )
  if (STAGING && MEDIA_BACKEND === "b2") {
    console.log("Tip: B2_* must be in apps/api/.dev.vars (or the environment) for uploads.")
  }
  await ensureFedbJson()
  const catalog = JSON.parse(fs.readFileSync(FEDB_JSON, "utf8"))
  const list = LIMIT ? catalog.slice(0, LIMIT) : catalog

  if (D1_ONLY) {
    const rows = rowsFromLocalCache(list)
    writeD1Catalog(rows)
    if (!LIMIT) remapLegacyIds()
    const withMedia = rows.filter((r) => r.hasGif).length
    console.log(`Done. ${rows.length} exercises in D1, ${withMedia} marked with media keys.`)
    return
  }

  if (UPLOAD_ONLY) {
    const outRoot = path.join(CACHE, "out")
    const uploads = []
    for (const slug of fs.readdirSync(outRoot)) {
      const dir = path.join(outRoot, slug)
      if (!fs.statSync(dir).isDirectory()) continue
      for (const name of ["start.webp", "end.webp", "thumb.webp"]) {
        const filePath = path.join(dir, name)
        if (!fs.existsSync(filePath)) continue
        uploads.push({ key: `exercises/${slug}/${name}`, filePath, contentType: "image/webp" })
      }
    }
    console.log(`Uploading ${uploads.length} cached WebP objects to ${MEDIA_BACKEND}…`)
    if (!SKIP_UPLOAD && uploads.length > 0) await putMediaPool(uploads)
    const thumbUpdates = uploads.filter((u) => u.key.endsWith("/thumb.webp"))
    if (thumbUpdates.length > 0) {
      console.log("Updating D1 gif_r2_key paths…")
      const sql = thumbUpdates
        .map((u) => {
          const slug = u.key.match(/exercises\/(.+)\/thumb\.webp/)?.[1]
          if (!slug) return ""
          return `UPDATE exercises SET has_gif = 1, gif_r2_key = ${sqlString(u.key)} WHERE id = ${sqlString(slug)};`
        })
        .filter(Boolean)
        .join("\n")
      if (sql) d1Exec(sql)
    }
    console.log(`Done. ${uploads.length} WebP files uploaded.`)
    return
  }

  if (MEDIA_ONLY) {
    console.log(`Regenerating WebP media (850:567 aspect, thumb 480×320 / stills 512×341) for ${list.length} exercises…`)
    const uploads = []
    for (let i = 0; i < list.length; i++) {
      const ex = list[i]
      const slug = fedbIdToSlug(ex.id)
      const images = ex.images ?? []
      if (images.length === 0) continue
      if ((i + 1) % 50 === 0 || i === 0) console.log(`  [${i + 1}/${list.length}] ${ex.name}`)
      try {
        const startBuf = await loadImage(images[0])
        const endBuf = images[1] ? await loadImage(images[1]) : null
        const tmpDir = path.join(CACHE, "out", slug)
        const built = buildExerciseMedia(startBuf, endBuf, tmpDir, slug, { skipR2: SKIP_UPLOAD })
        uploads.push(...built.uploads)
      } catch (err) {
        console.warn(`  ⚠ media skipped for ${slug}: ${err.message}`)
      }
    }
    if (!SKIP_UPLOAD && uploads.length > 0) {
      console.log(`Uploading ${uploads.length} WebP objects to ${MEDIA_BACKEND}…`)
      await putMediaPool(uploads)
    }
    if (uploads.length > 0) {
      console.log("Updating D1 gif_r2_key paths…")
      const thumbUpdates = uploads.filter((u) => u.key.endsWith("/thumb.webp"))
      const sql = thumbUpdates
        .map((u) => {
          const slug = u.key.match(/exercises\/(.+)\/thumb\.webp/)?.[1]
          if (!slug) return ""
          return `UPDATE exercises SET has_gif = 1, gif_r2_key = ${sqlString(u.key)} WHERE id = ${sqlString(slug)};`
        })
        .filter(Boolean)
        .join("\n")
      if (sql) d1Exec(sql)
    }
    console.log(`Done. ${uploads.length} WebP files regenerated (${uploads.length / 3 | 0} exercises with loops).`)
    return
  }

  console.log(`Processing ${list.length} / ${catalog.length} exercises…`)

  const rows = []
  const allUploads = []
  for (let i = 0; i < list.length; i++) {
    const ex = list[i]
    if ((i + 1) % 50 === 0 || i === 0) console.log(`  [${i + 1}/${list.length}] ${ex.name}`)
    const row = await processExercise(ex)
    allUploads.push(...row.uploads)
    const { uploads: _u, ...rest } = row
    rows.push(rest)
  }

  if (!SKIP_UPLOAD && allUploads.length > 0) {
    console.log(`Uploading ${allUploads.length} objects to ${MEDIA_BACKEND}…`)
    await putMediaPool(allUploads)
  }

  writeD1Catalog(rows)

  if (!LIMIT) remapLegacyIds()

  const withMedia = rows.filter((r) => r.hasGif).length
  console.log(`Done. ${rows.length} exercises in D1, ${withMedia} with ${MEDIA_BACKEND} media.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
