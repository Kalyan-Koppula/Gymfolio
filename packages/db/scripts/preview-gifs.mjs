#!/usr/bin/env node
/**
 * Local media preview — animated thumb WebP + start/end still WebPs.
 * Does NOT upload to R2 or change app code.
 *
 *   pnpm preview:gifs
 *
 * Open .cache/gif-review/index.html
 */
import fs from "node:fs"
import path from "node:path"
import { fedbIdToSlug } from "./lib/fedb-map.mjs"
import {
  buildStillWebp,
  buildThumbWebp,
  SOURCE_HEIGHT,
  SOURCE_WIDTH,
  STILL_QUALITY,
  STILL_WIDTH,
  THUMB_WIDTH,
  WEBP_QUALITY,
} from "./lib/media-build.mjs"

const AR = SOURCE_HEIGHT / SOURCE_WIDTH

function thumbPreset(width, quality) {
  return { width, height: Math.round(width * AR), quality }
}

function stillPreset(width, quality) {
  return { width, height: Math.round(width * AR), quality }
}

const ROOT = path.resolve(import.meta.dirname, "../../..")
const CACHE = path.join(ROOT, ".cache/free-exercise-db")
const FEDB_JSON = path.join(CACHE, "exercises.json")
const FEDB_IMAGES = path.join(CACHE, "images")
const OUT = path.join(ROOT, ".cache/gif-review")
const FEDB_RAW =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"
const FEDB_DIST =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"

const SAMPLES = [
  "Barbell_Full_Squat",
  "Pushups",
  "Pullups",
  "One-Arm_Dumbbell_Row",
  "Plank",
  "Wide-Grip_Lat_Pulldown",
]

/** Full presets: animated thumb + detail stills. Pick one after review. */
const PRESETS = [
  {
    id: "A",
    name: "A — Recommended",
    thumb: thumbPreset(480, WEBP_QUALITY),
    still: stillPreset(STILL_WIDTH, STILL_QUALITY),
  },
  {
    id: "B",
    name: "B — Larger detail",
    thumb: thumbPreset(560, WEBP_QUALITY),
    still: stillPreset(640, STILL_QUALITY),
  },
  {
    id: "C",
    name: "C — Smaller files",
    thumb: thumbPreset(400, 65),
    still: stillPreset(448, 70),
  },
]

async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  if (fs.existsSync(dest)) return
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`)
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

async function loadImage(relativePath) {
  const local = path.join(FEDB_IMAGES, relativePath)
  await download(`${FEDB_RAW}/${relativePath}`, local)
  return fs.readFileSync(local)
}

async function ensureCatalog() {
  fs.mkdirSync(CACHE, { recursive: true })
  if (!fs.existsSync(FEDB_JSON)) await download(FEDB_DIST, FEDB_JSON)
}

function kb(file) {
  return `${Math.round(fs.statSync(file).size / 1024)} KB`
}

function writeIndex(presets) {
  const presetSections = presets
    .map(
      (p) => `
    <section class="preset" id="preset-${p.id}">
      <h2>Preset ${p.name}</h2>
      <p class="preset-meta">
        Animated thumb: ${p.thumb.size}px · q${p.thumb.quality} &nbsp;|&nbsp;
        Start/end stills: ${p.still.size}px · q${p.still.quality} WebP
      </p>
      ${p.exercises
        .map(
          (ex) => `
      <article class="exercise">
        <h3>${ex.name}</h3>
        <div class="layouts">
          <div class="layout-block">
            <p class="layout-label">Library card (~80px)</p>
            <div class="library-mock">
              <img src="${ex.thumb}" alt="" />
            </div>
            <p class="file-meta">thumb: ${ex.thumbKb}</p>
          </div>
          <div class="layout-block layout-block--wide">
            <p class="layout-label">Detail hero (full width)</p>
            <div class="detail-hero-mock">
              <img src="${ex.thumb}" alt="" />
            </div>
          </div>
        </div>
        <div class="layouts">
          <div class="layout-block">
            <p class="layout-label">Detail — Start still</p>
            <div class="still-mock">
              <img src="${ex.start}" alt="" />
            </div>
            <p class="file-meta">${ex.startKb}</p>
          </div>
          <div class="layout-block">
            <p class="layout-label">Detail — End still</p>
            <div class="still-mock">
              <img src="${ex.end}" alt="" />
            </div>
            <p class="file-meta">${ex.endKb}</p>
          </div>
          <div class="layout-block layout-block--compare">
            <p class="layout-label">Original JPG (current)</p>
            <div class="still-mock still-mock--muted">
              <img src="${ex.startJpg}" alt="" />
            </div>
            <p class="file-meta">${ex.jpgKb} (reference only)</p>
          </div>
        </div>
      </article>`,
        )
        .join("")}
    </section>`,
    )
    .join("")

  fs.writeFileSync(
    path.join(OUT, "index.html"),
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Exercise media preview</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #eee; margin: 0; padding: 24px; }
    .wrap { max-width: 960px; margin: 0 auto; }
    h1 { font-size: 1.2rem; margin: 0 0 8px; }
    .note { color: #999; font-size: 0.875rem; line-height: 1.5; margin-bottom: 32px; }
    .note strong { color: #ccc; }
    .preset { border-top: 1px solid #333; padding-top: 32px; margin-top: 32px; }
    .preset h2 { font-size: 1rem; margin: 0 0 4px; color: #fff; }
    .preset-meta { color: #888; font-size: 0.8rem; margin: 0 0 24px; }
    .exercise { background: #141414; border-radius: 16px; padding: 20px; margin-bottom: 20px; }
    .exercise h3 { margin: 0 0 16px; font-size: 0.95rem; }
    .layouts { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px; }
    .layout-block { flex: 1; min-width: 140px; }
    .layout-block--wide { flex: 2; min-width: 280px; }
    .layout-block--compare { opacity: 0.75; }
    .layout-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: #777; margin: 0 0 8px; }
    .library-mock {
      width: 80px; aspect-ratio: 850 / 567; border-radius: 8px; overflow: hidden; background: #222;
    }
    .detail-hero-mock {
      width: 100%; max-width: 420px; aspect-ratio: 850 / 567; border-radius: 12px; overflow: hidden; background: #222;
    }
    .still-mock {
      width: 100%; max-width: 200px; aspect-ratio: 850 / 567; border-radius: 8px; overflow: hidden; background: #222;
    }
    .still-mock--muted { border: 1px dashed #444; }
    .library-mock img, .detail-hero-mock img, .still-mock img {
      width: 100%; height: 100%; object-fit: contain; display: block;
    }
    .file-meta { font-size: 0.65rem; color: #666; margin: 6px 0 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Exercise media preview (local only)</h1>
    <p class="note">
      <strong>Nothing uploaded to R2</strong> and no app changes until you approve a preset.
      Animated loop = library + detail hero. Start/end = detail page stills (WebP instead of JPG).
      All assets use 850×567 catalog aspect — full exercise visible; portrait outliers get side bars only.
    </p>
    ${presetSections}
    <p class="note">Reply with preset letter (A, B, or C) to regenerate all ~873 exercises.</p>
  </div>
</body>
</html>`,
  )
}

async function main() {
  await ensureCatalog()
  const catalog = JSON.parse(fs.readFileSync(FEDB_JSON, "utf8"))
  const byId = new Map(catalog.map((e) => [e.id, e]))
  fs.mkdirSync(OUT, { recursive: true })

  const presetResults = []

  for (const preset of PRESETS) {
    const presetDir = path.join(OUT, `preset-${preset.id}`)
    fs.mkdirSync(presetDir, { recursive: true })
    const exercises = []

    for (const fedbId of SAMPLES) {
      const ex = byId.get(fedbId)
      if (!ex?.images?.[1]) continue
      const slug = fedbIdToSlug(fedbId)

      const startBuf = await loadImage(ex.images[0])
      const endBuf = await loadImage(ex.images[1])

      const thumbFile = `${slug}__thumb.webp`
      const startFile = `${slug}__start.webp`
      const endFile = `${slug}__end.webp`
      const jpgFile = `${slug}__start.jpg`

      const thumbPath = path.join(presetDir, thumbFile)
      const startPath = path.join(presetDir, startFile)
      const endPath = path.join(presetDir, endFile)
      const jpgPath = path.join(presetDir, jpgFile)

      fs.writeFileSync(jpgPath, startBuf)

      buildThumbWebp(startBuf, endBuf, thumbPath, preset.thumb)
      buildStillWebp(startBuf, startPath, preset.still)
      buildStillWebp(endBuf, endPath, preset.still)

      exercises.push({
        name: ex.name,
        thumb: `preset-${preset.id}/${thumbFile}`,
        start: `preset-${preset.id}/${startFile}`,
        end: `preset-${preset.id}/${endFile}`,
        startJpg: `preset-${preset.id}/${jpgFile}`,
        thumbKb: kb(thumbPath),
        startKb: kb(startPath),
        endKb: kb(endPath),
        jpgKb: kb(jpgPath),
      })

      console.log(
        `  preset ${preset.id} · ${slug} — thumb ${kb(thumbPath)}, start ${kb(startPath)}, end ${kb(endPath)}`,
      )
    }

    presetResults.push({ ...preset, exercises })
  }

  writeIndex(presetResults)
  console.log(`\nPreview: ${OUT}/index.html`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
