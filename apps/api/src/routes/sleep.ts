import { Hono } from "hono"
import { and, desc, eq } from "drizzle-orm"
import { sleepEntries } from "db"
import { CreateSleepEntryInputSchema } from "shared"
import { getDb } from "../lib/db.ts"
import { requireAuth } from "../middleware/auth.ts"
import { computeSleepHours } from "../lib/sleep-duration.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()
route.use(requireAuth)

function toResponse(row: typeof sleepEntries.$inferSelect) {
  return {
    id: row.id,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    hours: computeSleepHours(row.startTime, row.endTime),
    quality: row.qualityRating as 1 | 2 | 3 | 4 | 5,
    updatedAt: row.updatedAt,
  }
}

route.get("/", async (c) => {
  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const rows = await db
    .select()
    .from(sleepEntries)
    .where(and(eq(sleepEntries.tenantId, tenantId), eq(sleepEntries.userId, userId)))
    .orderBy(desc(sleepEntries.date))
  return c.json({ entries: rows.map(toResponse) })
})

route.post("/", async (c) => {
  const body = CreateSleepEntryInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const id = crypto.randomUUID()
  const updatedAt = Date.now()

  await db.insert(sleepEntries).values({
    id,
    tenantId,
    userId,
    date: body.data.date,
    startTime: body.data.startTime,
    endTime: body.data.endTime,
    qualityRating: body.data.quality,
    updatedAt,
  })

  return c.json(
    {
      entry: {
        id,
        date: body.data.date,
        startTime: body.data.startTime,
        endTime: body.data.endTime,
        hours: computeSleepHours(body.data.startTime, body.data.endTime),
        quality: body.data.quality,
        updatedAt,
      },
    },
    201,
  )
})

export { route as sleepRoutes }
