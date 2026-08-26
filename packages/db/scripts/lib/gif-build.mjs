import sharp from "sharp"
import gifenc from "gifenc"
import { execSync } from "node:child_process"
import fs from "node:fs"

const { GIFEncoder, quantize, applyPalette } = gifenc

/** @typedef {'contain' | 'cover'} FitMode */

/**
 * @param {Buffer} imageBuf
 * @param {{ size: number, fit: FitMode, sharpen?: boolean }} opts
 */
export async function frameRgba(imageBuf, opts) {
  let pipeline = sharp(imageBuf).rotate().resize(opts.size, opts.size, {
    fit: opts.fit,
    position: "attention",
  })
  if (opts.sharpen) pipeline = pipeline.sharpen({ sigma: 0.8, m1: 0.5, m2: 0.25 })
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { rgba: new Uint8ClampedArray(data), w: info.width, h: info.height }
}

/**
 * @param {Buffer} startBuf
 * @param {Buffer} endBuf
 * @param {{ size?: number, fit?: FitMode, sharpen?: boolean, delayMs?: number, colors?: number }} [opts]
 */
export async function buildThumbGif(startBuf, endBuf, opts = {}) {
  const size = opts.size ?? 320
  const fit = opts.fit ?? "cover"
  const delayMs = opts.delayMs ?? 900
  const colors = opts.colors ?? 256
  const frameOpts = { size, fit, sharpen: opts.sharpen ?? false }

  const frames = [await frameRgba(startBuf, frameOpts), await frameRgba(endBuf, frameOpts)]
  const gif = GIFEncoder()
  for (const { rgba, w, h } of frames) {
    const palette = quantize(rgba, colors)
    const index = applyPalette(rgba, palette)
    gif.writeFrame(index, w, h, { palette, delay: delayMs })
  }
  gif.finish()
  return Buffer.from(gif.bytes())
}

/**
 * Higher-quality photo GIF via ffmpeg palettegen (when ffmpeg is installed).
 */
export function buildThumbGifFfmpeg(startBuf, endBuf, outPath, opts = {}) {
  const size = opts.size ?? 320
  const delayMs = opts.delayMs ?? 900
  const tmp = `${outPath}.tmp`
  fs.mkdirSync(tmp, { recursive: true })
  const f0 = `${tmp}/0.jpg`
  const f1 = `${tmp}/1.jpg`
  const scaleCrop = `scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size}`

  fs.writeFileSync(f0, startBuf)
  fs.writeFileSync(f1, endBuf)

  const fps = 1000 / delayMs
  const filter = [
    `[0:v]${scaleCrop},fps=${fps}[a]`,
    `[1:v]${scaleCrop},fps=${fps}[b]`,
    `[a][b]concat=n=2:v=1:a=0,split[v0][v1]`,
    `[v0]palettegen=stats_mode=diff:max_colors=256[p]`,
    `[v1][p]paletteuse=dither=bayer:bayer_scale=3`,
  ].join(";")

  execSync(
    `ffmpeg -y -loop 1 -t 1 -i "${f0}" -loop 1 -t 1 -i "${f1}" -filter_complex "${filter}" -gifflags -transdiff "${outPath}"`,
    { stdio: "pipe" },
  )
  fs.rmSync(tmp, { recursive: true, force: true })
  return fs.readFileSync(outPath)
}

export function ffmpegAvailable() {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}
