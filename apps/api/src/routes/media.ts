/**
 * Serves exercise media.
 *
 * Preferred: set MEDIA_PUBLIC_ORIGIN to a public CDN/origin where objects are
 * readable at `{origin}/{key}` (R2 custom domain / r2.dev, or B2 + Cloudflare CDN /
 * public friendly URL). Then this Worker only issues a 302 — no byte proxy, no
 * Worker egress of image bodies.
 *
 * Fallback: stream from R2/B2 through the Worker + Cache API (legacy private buckets).
 *
 * Content-addressed keys: exercises/{slug}/{thumb|start|end}.{16-hex}.webp
 */
import { Hono } from "hono"
import type { Context } from "hono"
import { getMediaStore, publicMediaObjectUrl } from "../lib/media-store.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()

/** Browser + CDN: long-lived; safe with content-hashed object keys. */
const CACHE_CONTROL = "public, max-age=31536000, s-maxage=31536000, immutable"

/** Legacy unhashed filenames — shorter TTL because the same path can be overwritten. */
const CACHE_CONTROL_LEGACY = "public, max-age=86400, s-maxage=604800"

const HASHED_FILE =
  /^(thumb|start|end)\.[a-f0-9]{16}\.webp$/i
const LEGACY_FILE = /^(thumb|start|end)\.(webp|jpg|gif)$/i

function isSafeSlug(slug: string) {
  return /^[a-z0-9][a-z0-9_-]{0,120}$/i.test(slug)
}

async function serveMedia(
  c: Context<AppEnv>,
  key: string,
  fallbackType: string,
  cacheControl: string,
) {
  // Prefer CDN/DNS-level origin: Worker never touches object bytes.
  const publicUrl = publicMediaObjectUrl(c.env, key)
  if (publicUrl) {
    return c.redirect(publicUrl, 302)
  }

  const requestUrl = new URL(c.req.url)
  const cacheKey = new Request(new URL(requestUrl.pathname, requestUrl.origin).toString(), {
    method: "GET",
  })

  const cache = caches.default
  const cached = await cache.match(cacheKey)
  if (cached) {
    const hit = new Response(cached.body, cached)
    hit.headers.set("X-Media-Cache", "HIT")
    return hit
  }

  const store = getMediaStore(c.env)
  if (!store) {
    return c.json(
      {
        error: "Media storage not configured",
        hint:
          c.env.MEDIA_BACKEND === "b2"
            ? "Set B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET, B2_ENDPOINT (Worker secrets / .dev.vars) — or MEDIA_PUBLIC_ORIGIN for CDN redirects"
            : "Bind MEDIA (R2) or set MEDIA_BACKEND=b2 with Backblaze credentials — or MEDIA_PUBLIC_ORIGIN for CDN redirects",
      },
      503,
    )
  }

  const obj = await store.get(key)
  if (!obj?.body) return c.body(null, 404)

  const headers = new Headers()
  headers.set("Content-Type", obj.contentType ?? fallbackType)
  headers.set("Cache-Control", cacheControl)
  headers.set("X-Media-Cache", "MISS")
  headers.set("Access-Control-Allow-Origin", "*")

  const response = new Response(obj.body, { headers })
  c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}

/**
 * GET /api/media/exercises/:slug/:file
 * file = thumb.<hash>.webp | start.<hash>.webp | end.<hash>.webp
 *      or legacy thumb.webp / start.jpg / …
 */
route.get("/exercises/:slug/:file", (c) => {
  const slug = c.req.param("slug")
  const file = c.req.param("file")
  if (!isSafeSlug(slug)) return c.body(null, 400)

  if (HASHED_FILE.test(file)) {
    const ext = file.toLowerCase().endsWith(".webp") ? "image/webp" : "application/octet-stream"
    return serveMedia(c, `exercises/${slug}/${file}`, ext, CACHE_CONTROL)
  }

  if (LEGACY_FILE.test(file)) {
    // Legacy GIF path was exercises/{slug}.gif (no folder) — keep stills/thumbs under slug/.
    if (file === "thumb.gif") {
      return serveMedia(c, `exercises/${slug}.gif`, "image/gif", CACHE_CONTROL_LEGACY)
    }
    const type = file.endsWith(".jpg") ? "image/jpeg" : file.endsWith(".gif") ? "image/gif" : "image/webp"
    return serveMedia(c, `exercises/${slug}/${file}`, type, CACHE_CONTROL_LEGACY)
  }

  return c.body(null, 404)
})

export { route as mediaRoutes }
