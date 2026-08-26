import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import {
  buildStillWebp,
  buildThumbWebp,
  endWebpKey,
  startWebpKey,
  STILL_HEIGHT,
  STILL_QUALITY,
  STILL_WIDTH,
  thumbR2Key,
  THUMB_HEIGHT,
  THUMB_WIDTH,
  WEBP_QUALITY,
} from "./media-build.mjs"

/** Preset A — 850:567 catalog aspect (not square). */
export const THUMB_OPTS = { width: THUMB_WIDTH, height: THUMB_HEIGHT, quality: WEBP_QUALITY }
export const STILL_OPTS = { width: STILL_WIDTH, height: STILL_HEIGHT, quality: STILL_QUALITY }

/**
 * Build animated thumb + start/end still WebPs for one exercise.
 * @returns {{ uploads: Array<{key,filePath,contentType}>, hasGif: number, gifR2Key: string|null }}
 */
export function buildExerciseMedia(startBuf, endBuf, tmpDir, slug, { skipR2 = false } = {}) {
  const uploads = []
  fs.mkdirSync(tmpDir, { recursive: true })

  const startWebpPath = path.join(tmpDir, "start.webp")
  buildStillWebp(startBuf, startWebpPath, STILL_OPTS)
  if (!skipR2)
    uploads.push({ key: startWebpKey(slug), filePath: startWebpPath, contentType: "image/webp" })

  if (!endBuf) {
    return { uploads, hasGif: 0, gifR2Key: null }
  }

  const endWebpPath = path.join(tmpDir, "end.webp")
  buildStillWebp(endBuf, endWebpPath, STILL_OPTS)
  if (!skipR2) uploads.push({ key: endWebpKey(slug), filePath: endWebpPath, contentType: "image/webp" })

  const thumbPath = path.join(tmpDir, "thumb.webp")
  buildThumbWebp(startBuf, endBuf, thumbPath, THUMB_OPTS)
  if (!skipR2)
    uploads.push({ key: thumbR2Key(slug), filePath: thumbPath, contentType: "image/webp" })

  return { uploads, hasGif: 1, gifR2Key: thumbR2Key(slug) }
}

export function ffmpegAvailable() {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}
