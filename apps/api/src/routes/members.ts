import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { users } from "db"
import type { Role } from "shared"
import { getDb } from "../lib/db.ts"
import { destroyAllSessionsForUser } from "../lib/session.ts"
import { requireAuth } from "../middleware/auth.ts"
import { requireOwner } from "../middleware/require-owner.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()
route.use(requireAuth, requireOwner)

route.get("/", async (c) => {
  const { tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const rows = await db.select().from(users).where(eq(users.tenantId, tenantId))
  return c.json({
    members: rows.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role as Role,
      deactivated: u.deactivatedAt != null,
      createdAt: u.createdAt,
    })),
  })
})

// Revokes login, keeps the member's logged data untouched — leaving the family instance
// means losing access, not losing your history.
route.post("/:userId/deactivate", async (c) => {
  const auth = c.get("auth")
  const targetId = c.req.param("userId")
  if (targetId === auth.userId) return c.json({ error: "The owner can't deactivate themselves" }, 400)

  const db = getDb(c.env.DB)
  await db.update(users).set({ deactivatedAt: Date.now() }).where(eq(users.id, targetId))
  await destroyAllSessionsForUser(db, c.env.SESSIONS_KV, targetId)
  return c.body(null, 204)
})

route.post("/:userId/reactivate", async (c) => {
  const db = getDb(c.env.DB)
  await db.update(users).set({ deactivatedAt: null }).where(eq(users.id, c.req.param("userId")))
  return c.body(null, 204)
})

export { route as memberRoutes }
