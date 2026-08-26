#!/usr/bin/env node
/**
 * Seeds free-exercise-db metadata into D1, gym photos + thumb GIFs into local R2,
 * and remaps legacy ex-N exercise IDs in routines / workout logs.
 *
 * Usage (from repo root):
 *   pnpm seed:media              # full catalog (~873 exercises)
 *   pnpm seed:media -- --limit 20  # smoke subset
 *   pnpm seed:media -- --media-only   # regenerate WebP thumb + stills only
 *   pnpm seed:media -- --upload-only  # upload cached WebPs to local R2 (no re-encode)
 *   pnpm preview:gifs                 # local WebP quality comparison (no R2)
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

const ROOT = path.resolve(import.meta.dirname, "../../..")
const CACHE = path.join(ROOT, ".cache/free-exercise-db")
const FEDB_JSON = path.join(CACHE, "exercises.json")
const FEDB_IMAGES = path.join(CACHE, "images")
const API_DIR = path.join(ROOT, "apps/api")
const R2_BUCKET = "fitness-tracker-media"
const FEDB_RAW =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"
const FEDB_DIST =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"

const args = process.argv.slice(2).filter((a) => a !== "--")
const limitIdx = args.indexOf("--limit")
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : null
const SKIP_R2 = args.includes("--skip-r2")
const SKIP_IMAGES = args.includes("--skip-images")
const MEDIA_ONLY = args.includes("--media-only") || args.includes("--thumbs-only") || args.includes("--gifs-only")
const UPLOAD_ONLY = args.includes("--upload-only")

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

function putR2Bulk(tasks) {
  if (tasks.length === 0) return
  const mapPath = path.join(CACHE, "r2-bulk-upload.json")
  const entries = tasks.map((t) => ({ key: t.key, file: t.filePath }))
  fs.writeFileSync(mapPath, JSON.stringify(entries))
  console.log(`Bulk uploading ${tasks.length} objects via wrangler r2 bulk put…`)
  wrangler(
    `r2 bulk put ${R2_BUCKET} --filename=${mapPath} --local --content-type image/webp --concurrency 50 -y`,
  )
}

async function putR2Pool(tasks) {
  putR2Bulk(tasks)
}

function d1Exec(sql) {
  const tmp = path.join(CACHE, "seed-batch.sql")
  fs.writeFileSync(tmp, sql)
  wrangler(`d1 execute fitness-tracker --local --file=${tmp}`)
}

function d1Query(sql) {
  return JSON.parse(wranglerOut(`d1 execute fitness-tracker --local --command=${JSON.stringify(sql)} --json`))
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
      const built = buildExerciseMedia(startBuf, endBuf, tmpDir, slug, { skipR2: SKIP_R2 })
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
    .join(",\n")
  return `INSERT INTO exercises (id, name, muscle_groups_json, equipment_json, difficulty, instructions, has_gif, gif_r2_key, youtube_status, youtube_json) VALUES\n${values};`
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
  console.log("Exercise media seed")
  await ensureFedbJson()
  const catalog = JSON.parse(fs.readFileSync(FEDB_JSON, "utf8"))
  const list = LIMIT ? catalog.slice(0, LIMIT) : catalog

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
    console.log(`Uploading ${uploads.length} cached WebP objects to local R2…`)
    if (!SKIP_R2 && uploads.length > 0) await putR2Pool(uploads)
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
        const built = buildExerciseMedia(startBuf, endBuf, tmpDir, slug, { skipR2: SKIP_R2 })
        uploads.push(...built.uploads)
      } catch (err) {
        console.warn(`  ⚠ media skipped for ${slug}: ${err.message}`)
      }
    }
    if (!SKIP_R2 && uploads.length > 0) {
      console.log(`Uploading ${uploads.length} WebP objects to local R2…`)
      await putR2Pool(uploads)
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

  if (!SKIP_R2 && allUploads.length > 0) {
    console.log(`Uploading ${allUploads.length} objects to local R2…`)
    await putR2Pool(allUploads)
  }

  console.log("Writing D1 catalog…")
  d1Exec("DELETE FROM exercises;")
  const BATCH = 40
  for (let i = 0; i < rows.length; i += BATCH) {
    d1Exec(buildInsertBatch(rows.slice(i, i + BATCH)))
  }

  if (!LIMIT) remapLegacyIds()

  const withMedia = rows.filter((r) => r.hasGif).length
  console.log(`Done. ${rows.length} exercises in D1, ${withMedia} with R2 media.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
