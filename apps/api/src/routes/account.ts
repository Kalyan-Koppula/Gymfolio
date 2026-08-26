import { Hono } from "hono"
import { getCookie } from "hono/cookie"
import { desc, eq } from "drizzle-orm"
import { sessions, users } from "db"
import { ChangePasswordInputSchema } from "shared"
import { getDb } from "../lib/db.ts"
import { hashPassword, verifyPassword } from "../lib/password.ts"
import { destroySession, SESSION_COOKIE } from "../lib/session.ts"
import { requireAuth } from "../middleware/auth.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()
route.use(requireAuth)

function formatLastActive(expiresAt: number, isCurrent: boolean): string {
  if (isCurrent) return "Active now"
  // Sessions are created with a 30-day TTL; approximate last activity as expiry - 30d.
  const createdApprox = expiresAt - 30 * 24 * 60 * 60 * 1000
  const agoMs = Date.now() - createdApprox
  const hours = Math.floor(agoMs / (60 * 60 * 1000))
  if (hours < 1) return "Just now"
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

route.get("/sessions", async (c) => {
  const { userId } = c.get("auth")
  const currentId = getCookie(c, SESSION_COOKIE)
  const db = getDb(c.env.DB)

  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.expiresAt))

  const list = rows
    .filter((r) => r.expiresAt > Date.now())
    .map((r) => ({
      id: r.id,
      lastActive: formatLastActive(r.expiresAt, r.id === currentId),
      current: r.id === currentId,
      expiresAt: r.expiresAt,
    }))

  return c.json({ sessions: list })
})

route.delete("/sessions/:id", async (c) => {
  const { userId } = c.get("auth")
  const currentId = getCookie(c, SESSION_COOKIE)
  const id = c.req.param("id")
  const db = getDb(c.env.DB)

  if (id === currentId) return c.json({ error: "Can't revoke the current session — use Log out" }, 400)

  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1)

  if (!row || row.userId !== userId) return c.json({ error: "Session not found" }, 404)

  await destroySession(db, c.env.SESSIONS_KV, id)
  return c.body(null, 204)
})

route.post("/change-password", async (c) => {
  const body = ChangePasswordInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const { userId } = c.get("auth")
  const db = getDb(c.env.DB)
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return c.json({ error: "User not found" }, 404)

  const valid = await verifyPassword(body.data.currentPassword, user.passwordHash)
  if (!valid) return c.json({ error: "Current password is incorrect" }, 401)

  const passwordHash = await hashPassword(body.data.newPassword)
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId))

  return c.json({ ok: true })
})

export { route as accountRoutes }
