/**
 * Serves exercise media bytes from the configured store (R2 or Backblaze B2).
 * Without an object, returns 404 — the client treats missing media as a calm placeholder.
 */
import { Hono } from "hono"
import type { Context } from "hono"
import { getMediaStore } from "../lib/media-store.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()

const CACHE = "public, max-age=604800"

async function serveMedia(c: Context<AppEnv>, key: string, fallbackType: string) {
  const store = getMediaStore(c.env)
  if (!store) {
    return c.json(
      {
        error: "Media storage not configured",
        hint:
          c.env.MEDIA_BACKEND === "b2"
            ? "Set B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET, B2_ENDPOINT (Worker secrets / .dev.vars)"
            : "Bind MEDIA (R2) or set MEDIA_BACKEND=b2 with Backblaze credentials",
      },
      503,
    )
  }

  const obj = await store.get(key)
  if (!obj?.body) return c.body(null, 404)

  const headers = new Headers()
  headers.set("Content-Type", obj.contentType ?? fallbackType)
  headers.set("Cache-Control", CACHE)
  return new Response(obj.body, { headers })
}

route.get("/exercises/:slug/thumb.webp", (c) => {
  const slug = c.req.param("slug")
  return serveMedia(c, `exercises/${slug}/thumb.webp`, "image/webp")
})

/** Legacy GIF path — serves old objects if present. */
route.get("/exercises/:slug/thumb.gif", (c) => {
  const slug = c.req.param("slug")
  return serveMedia(c, `exercises/${slug}.gif`, "image/gif")
})

route.get("/exercises/:id/start.webp", (c) => {
  const id = c.req.param("id")
  return serveMedia(c, `exercises/${id}/start.webp`, "image/webp")
})

route.get("/exercises/:id/end.webp", (c) => {
  const id = c.req.param("id")
  return serveMedia(c, `exercises/${id}/end.webp`, "image/webp")
})

/** Legacy JPEG stills — served if old objects remain in the bucket. */
route.get("/exercises/:id/start.jpg", (c) => {
  const id = c.req.param("id")
  return serveMedia(c, `exercises/${id}/start.jpg`, "image/jpeg")
})

route.get("/exercises/:id/end.jpg", (c) => {
  const id = c.req.param("id")
  return serveMedia(c, `exercises/${id}/end.jpg`, "image/jpeg")
})

export { route as mediaRoutes }
