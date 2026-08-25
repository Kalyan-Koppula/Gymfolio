import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { routines } from "db"
import { SaveRoutineInputSchema, type Routine, type RoutineDay, type SchedulePattern, type SplitType } from "shared"
import { getDb } from "../lib/db.ts"
import { requireAuth } from "../middleware/auth.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()
route.use(requireAuth)

function toResponse(row: typeof routines.$inferSelect): Routine {
  return {
    name: row.name,
    splitType: row.splitType as SplitType,
    schedule: JSON.parse(row.scheduleJson) as SchedulePattern,
    days: JSON.parse(row.daysJson) as RoutineDay[],
    updatedAt: row.updatedAt,
  }
}

route.get("/", async (c) => {
  const { userId } = c.get("auth")
  const db = getDb(c.env.DB)
  const [row] = await db.select().from(routines).where(eq(routines.userId, userId)).limit(1)
  return c.json({ routine: row ? toResponse(row) : null })
})

// Replaces the routine wholesale — no partial-day updates, no history of prior routines.
route.put("/", async (c) => {
  const body = SaveRoutineInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const now = Date.now()

  const [existing] = await db.select({ createdAt: routines.createdAt }).from(routines).where(eq(routines.userId, userId)).limit(1)

  const values = {
    userId,
    tenantId,
    name: body.data.name,
    splitType: body.data.splitType,
    scheduleJson: JSON.stringify(body.data.schedule),
    daysJson: JSON.stringify(body.data.days),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await db.insert(routines).values(values).onConflictDoUpdate({ target: routines.userId, set: values })

  return c.json({ routine: { ...body.data, updatedAt: now } satisfies Routine })
})

export { route as routineRoutes }
