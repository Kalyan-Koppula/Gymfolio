import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import {
  buildStillWebp,
  buildThumbWebp,
  contentHash,
  hashedMediaKey,
  STILL_HEIGHT,
  STILL_QUALITY,
  STILL_WIDTH,
  THUMB_HEIGHT,
  THUMB_WIDTH,
  WEBP_QUALITY,
} from "./media-build.mjs"

/** Preset A — 850:567 catalog aspect (not square). */
export const THUMB_OPTS = { width: THUMB_WIDTH, height: THUMB_HEIGHT, quality: WEBP_QUALITY }
export const STILL_OPTS = { width: STILL_WIDTH, height: STILL_HEIGHT, quality: STILL_QUALITY }

/**
 * Hash local WebPs under out/{slug}/ and write media.json.
 * Local filenames stay stable (thumb.webp); object keys are content-addressed.
 *
 * @returns {{ media: { thumb?: string, start?: string, end?: string }, uploads: Array<{key,filePath,contentType}>, hasGif: number, gifR2Key: string|null }}
 */
export function resolveHashedMediaFromDir(tmpDir, slug) {
  /** @type {{ thumb?: string, start?: string, end?: string }} */
  const media = {}
  /** @type {Array<{key: string, filePath: string, contentType: string}>} */
  const uploads = []

  for (const kind of /** @type {const} */ (["start", "end", "thumb"])) {
    const filePath = path.join(tmpDir, `${kind}.webp`)
    if (!fs.existsSync(filePath)) continue
    const buf = fs.readFileSync(filePath)
    const key = hashedMediaKey(slug, kind, contentHash(buf))
    media[kind] = key
    uploads.push({ key, filePath, contentType: "image/webp" })
  }

  fs.writeFileSync(path.join(tmpDir, "media.json"), JSON.stringify(media, null, 2) + "\n")
  const hasGif = media.thumb ? 1 : 0
  return { media, uploads, hasGif, gifR2Key: media.thumb ?? null }
}

/**
 * Build animated thumb + start/end still WebPs for one exercise.
 * Uploads use content-hashed keys; local cache keeps unhashed filenames + media.json.
 *
 * @returns {{ uploads: Array<{key,filePath,contentType}>, hasGif: number, gifR2Key: string|null, media: Record<string,string> }}
 */
export function buildExerciseMedia(startBuf, endBuf, tmpDir, slug, { skipR2 = false } = {}) {
  fs.mkdirSync(tmpDir, { recursive: true })

  const startWebpPath = path.join(tmpDir, "start.webp")
  buildStillWebp(startBuf, startWebpPath, STILL_OPTS)

  if (!endBuf) {
    const resolved = resolveHashedMediaFromDir(tmpDir, slug)
    return {
      uploads: skipR2 ? [] : resolved.uploads,
      hasGif: 0,
      gifR2Key: null,
      media: { start: resolved.media.start },
    }
  }

  const endWebpPath = path.join(tmpDir, "end.webp")
  buildStillWebp(endBuf, endWebpPath, STILL_OPTS)

  const thumbPath = path.join(tmpDir, "thumb.webp")
  buildThumbWebp(startBuf, endBuf, thumbPath, THUMB_OPTS)

  const resolved = resolveHashedMediaFromDir(tmpDir, slug)
  return {
    uploads: skipR2 ? [] : resolved.uploads,
    hasGif: resolved.hasGif,
    gifR2Key: resolved.gifR2Key,
    media: resolved.media,
  }
}

export function ffmpegAvailable() {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}
