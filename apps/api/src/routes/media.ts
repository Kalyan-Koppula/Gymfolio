/**
 * Serves exercise media bytes from R2 when present. Without an object, returns 404 —
 * the client treats missing media as a calm placeholder.
 */
import { Hono } from "hono"
import type { Context } from "hono"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()

const CACHE = "public, max-age=604800"

async function serveR2(c: Context<AppEnv>, key: string, fallbackType: string) {
  const bucket = c.env.MEDIA
  if (!bucket) return c.json({ error: "Media storage not configured" }, 503)

  const obj = await bucket.get(key)
  if (!obj) return c.body(null, 404)

  const headers = new Headers()
  headers.set("Content-Type", obj.httpMetadata?.contentType ?? fallbackType)
  headers.set("Cache-Control", CACHE)
  return new Response(obj.body, { headers })
}

route.get("/exercises/:slug/thumb.webp", (c) => {
  const slug = c.req.param("slug")
  return serveR2(c, `exercises/${slug}/thumb.webp`, "image/webp")
})

/** Legacy GIF path — serves old objects if present. */
route.get("/exercises/:slug/thumb.gif", (c) => {
  const slug = c.req.param("slug")
  return serveR2(c, `exercises/${slug}.gif`, "image/gif")
})

route.get("/exercises/:id/start.webp", (c) => {
  const id = c.req.param("id")
  return serveR2(c, `exercises/${id}/start.webp`, "image/webp")
})

route.get("/exercises/:id/end.webp", (c) => {
  const id = c.req.param("id")
  return serveR2(c, `exercises/${id}/end.webp`, "image/webp")
})

/** Legacy JPEG stills — served if old objects remain in R2. */
route.get("/exercises/:id/start.jpg", (c) => {
  const id = c.req.param("id")
  return serveR2(c, `exercises/${id}/start.jpg`, "image/jpeg")
})

route.get("/exercises/:id/end.jpg", (c) => {
  const id = c.req.param("id")
  return serveR2(c, `exercises/${id}/end.jpg`, "image/jpeg")
})

export { route as mediaRoutes }
