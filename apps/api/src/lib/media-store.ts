/**
 * Exercise media object store — Cloudflare R2 (binding) or Backblaze B2 (S3-compatible).
 * Selected by env.MEDIA_BACKEND = "r2" | "b2" (default "r2").
 */
import { AwsClient } from "aws4fetch"
import type { Bindings } from "../types.ts"

export type MediaObject = {
  body: ReadableStream | null
  contentType: string | null
}

export type MediaStore = {
  get(key: string): Promise<MediaObject | null>
}

function backendOf(env: Bindings): "r2" | "b2" {
  const raw = (env.MEDIA_BACKEND ?? "r2").trim().toLowerCase()
  return raw === "b2" ? "b2" : "r2"
}

function createR2Store(env: Bindings): MediaStore | null {
  const bucket = env.MEDIA
  if (!bucket) return null
  return {
    async get(key) {
      const obj = await bucket.get(key)
      if (!obj) return null
      return {
        body: obj.body,
        contentType: obj.httpMetadata?.contentType ?? null,
      }
    },
  }
}

function b2Region(env: Bindings): string {
  if (env.B2_REGION?.trim()) return env.B2_REGION.trim()
  const endpoint = env.B2_ENDPOINT ?? ""
  // https://s3.us-west-004.backblazeb2.com → us-west-004
  const m = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i)
  return m?.[1] ?? "us-west-004"
}

function createB2Store(env: Bindings): MediaStore | null {
  const keyId = env.B2_KEY_ID?.trim()
  const appKey = env.B2_APPLICATION_KEY?.trim()
  const bucket = env.B2_BUCKET?.trim()
  const endpoint = env.B2_ENDPOINT?.replace(/\/$/, "").trim()
  if (!keyId || !appKey || !bucket || !endpoint) return null

  const client = new AwsClient({
    accessKeyId: keyId,
    secretAccessKey: appKey,
    service: "s3",
    region: b2Region(env),
  })

  return {
    async get(key) {
      const url = `${endpoint}/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`
      const res = await client.fetch(url, { method: "GET" })
      if (res.status === 404) return null
      if (!res.ok) {
        console.error(`B2 GET ${key} failed: ${res.status}`)
        return null
      }
      return {
        body: res.body,
        contentType: res.headers.get("content-type"),
      }
    },
  }
}

/** Resolve the configured media backend; null if misconfigured. */
export function getMediaStore(env: Bindings): MediaStore | null {
  return backendOf(env) === "b2" ? createB2Store(env) : createR2Store(env)
}

export function mediaBackendLabel(env: Bindings): "r2" | "b2" {
  return backendOf(env)
}
