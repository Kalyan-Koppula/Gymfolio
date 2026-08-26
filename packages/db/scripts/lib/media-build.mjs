import { execSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

/** Dominant free-exercise-db photo size (850×567, ~80% of catalog). */
export const SOURCE_WIDTH = 850
export const SOURCE_HEIGHT = 567

/** Output widths; height derived from source aspect — not square. */
export const THUMB_WIDTH = 480
export const THUMB_HEIGHT = Math.round((THUMB_WIDTH * SOURCE_HEIGHT) / SOURCE_WIDTH)
export const STILL_WIDTH = 512
export const STILL_HEIGHT = Math.round((STILL_WIDTH * SOURCE_HEIGHT) / SOURCE_WIDTH)

/** @deprecated use STILL_WIDTH */
export const STILL_SIZE = STILL_WIDTH
/** @deprecated use THUMB_WIDTH */
export const THUMB_SIZE = THUMB_WIDTH

export const WEBP_QUALITY = 70
export const STILL_QUALITY = 75
export const FRAME_DELAY_MS = 900

export function ffmpegAvailable() {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

export function img2webpAvailable() {
  try {
    execSync("img2webp -version", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

export function cwebpAvailable() {
  try {
    execSync("cwebp -version", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

/** Scale to fit inside w×h, pad only when source aspect differs (portrait outliers). */
function fitCanvasFilter(width, height, padColor = "0x27272a") {
  return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${padColor}`
}

/**
 * Single-frame still → WebP at catalog aspect ratio (850:567).
 */
export function buildStillWebp(imageBuf, outPath, opts = {}) {
  if (!ffmpegAvailable()) throw new Error("ffmpeg not found")
  if (!cwebpAvailable()) throw new Error("cwebp not found — brew install webp")

  const width = opts.width ?? STILL_WIDTH
  const height = opts.height ?? STILL_HEIGHT
  const quality = opts.quality ?? STILL_QUALITY
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gymapp-still-"))
  const src = path.join(tmp, "src.jpg")
  const png = path.join(tmp, "frame.png")

  fs.writeFileSync(src, imageBuf)
  execSync(`ffmpeg -y -i "${src}" -vf "${fitCanvasFilter(width, height)}" "${png}"`, { stdio: "pipe" })
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  execSync(`cwebp -q ${quality} "${png}" -o "${outPath}"`, { stdio: "pipe" })
  fs.rmSync(tmp, { recursive: true, force: true })
  return fs.readFileSync(outPath)
}

/** R2 keys for still WebP assets. */
export function startWebpKey(slug) {
  return `exercises/${slug}/start.webp`
}

export function endWebpKey(slug) {
  return `exercises/${slug}/end.webp`
}

/**
 * Animated thumb WebP — same 850:567 canvas for both frames (img2webp requires matching size).
 */
export function buildThumbWebp(startBuf, endBuf, outPath, opts = {}) {
  if (!ffmpegAvailable()) throw new Error("ffmpeg not found — install via brew install ffmpeg")
  if (!img2webpAvailable()) throw new Error("img2webp not found — install via brew install webp")

  const width = opts.width ?? THUMB_WIDTH
  const height = opts.height ?? THUMB_HEIGHT
  const quality = opts.quality ?? WEBP_QUALITY
  const delayMs = opts.delayMs ?? FRAME_DELAY_MS
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gymapp-thumb-"))
  const f0 = path.join(tmp, "0.jpg")
  const f1 = path.join(tmp, "1.jpg")
  const fit = fitCanvasFilter(width, height)

  fs.writeFileSync(path.join(tmp, "start-src.jpg"), startBuf)
  fs.writeFileSync(path.join(tmp, "end-src.jpg"), endBuf)

  execSync(`ffmpeg -y -i "${path.join(tmp, "start-src.jpg")}" -vf "${fit}" "${f0}"`, { stdio: "pipe" })
  execSync(`ffmpeg -y -i "${path.join(tmp, "end-src.jpg")}" -vf "${fit}" "${f1}"`, { stdio: "pipe" })

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  execSync(
    `img2webp -o "${outPath}" -loop 0 -d ${delayMs} -q ${quality} -m 6 "${f0}" "${f1}"`,
    { stdio: "pipe" },
  )

  fs.rmSync(tmp, { recursive: true, force: true })
  return fs.readFileSync(outPath)
}

/** R2 object key for the animated exercise thumb. */
export function thumbR2Key(slug) {
  return `exercises/${slug}/thumb.webp`
}
