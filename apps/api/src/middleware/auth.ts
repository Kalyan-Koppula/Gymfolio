import { createMiddleware } from "hono/factory"
import { getCookie } from "hono/cookie"
import { getDb } from "../lib/db.ts"
import { maybeExtendSession, resolveSession, SESSION_COOKIE } from "../lib/session.ts"
import { setSessionCookie } from "../lib/session-response.ts"
import type { AppEnv } from "../types.ts"

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const sessionId = getCookie(c, SESSION_COOKIE)
  if (!sessionId) return c.json({ error: "Not authenticated" }, 401)

  const db = getDb(c.env.DB)
  const auth = await resolveSession(db, c.env.SESSIONS_KV, sessionId)
  if (!auth) return c.json({ error: "Session expired or invalid" }, 401)

  // Sliding TTL — keep active devices signed in without minting new sessions.
  const nextExpires = await maybeExtendSession(db, c.env.SESSIONS_KV, sessionId, auth)
  if (nextExpires != null) {
    setSessionCookie(c, sessionId, nextExpires)
  }

  c.set("auth", auth)
  await next()
})
