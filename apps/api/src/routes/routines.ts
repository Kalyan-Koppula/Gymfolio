import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { routines } from "db"
import {
  SaveRoutineInputSchema,
  normalizeRoutineExercises,
  type Routine,
  type RoutineDay,
  type SchedulePattern,
  type SplitType,
} from "shared"
import { getDb } from "../lib/db.ts"
import { requireAuth } from "../middleware/auth.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()
route.use(requireAuth)

/** Backfill dayType / orderIndex (and exercise orderIndex) for routines saved before later passes. */
function normalizeDays(raw: RoutineDay[]): RoutineDay[] {
  return raw.map((d, i) => ({
    id: d.id,
    label: d.label,
    dayType: d.dayType ?? "training",
    orderIndex: typeof d.orderIndex === "number" ? d.orderIndex : i,
    exercises: (d.dayType ?? "training") === "rest" ? [] : normalizeRoutineExercises(d.exercises ?? []),
    archivedAt: d.archivedAt ?? null,
  }))
}

function toResponse(row: typeof routines.$inferSelect): Routine {
  return {
    name: row.name,
    splitType: row.splitType as SplitType,
    schedule: JSON.parse(row.scheduleJson) as SchedulePattern,
    days: normalizeDays(JSON.parse(row.daysJson) as RoutineDay[]),
    updatedAt: row.updatedAt,
  }
}

route.get("/", async (c) => {
  const { userId } = c.get("auth")
  const db = getDb(c.env.DB)
  const [row] = await db.select().from(routines).where(eq(routines.userId, userId)).limit(1)
  return c.json({ routine: row ? toResponse(row) : null })
})

route.put("/", async (c) => {
  const body = SaveRoutineInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const now = Date.now()
  const days = normalizeDays(body.data.days)

  const [existing] = await db.select({ createdAt: routines.createdAt }).from(routines).where(eq(routines.userId, userId)).limit(1)

  const values = {
    userId,
    tenantId,
    name: body.data.name,
    splitType: body.data.splitType,
    scheduleJson: JSON.stringify(body.data.schedule),
    daysJson: JSON.stringify(days),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await db.insert(routines).values(values).onConflictDoUpdate({ target: routines.userId, set: values })

  return c.json({ routine: { ...body.data, days, updatedAt: now } satisfies Routine })
})

export { route as routineRoutes }
