import { Hono } from "hono"
import { and, desc, eq } from "drizzle-orm"
import { bodyMetricEntries } from "db"
import { CreateBodyMetricEntryInputSchema } from "shared"
import { getDb } from "../lib/db.ts"
import { requireAuth } from "../middleware/auth.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()
route.use(requireAuth)

function toResponse(row: typeof bodyMetricEntries.$inferSelect) {
  return {
    id: row.id,
    date: row.date,
    weightKg: row.weightKg,
    measurements: row.measurementsJson ? JSON.parse(row.measurementsJson) : undefined,
    updatedAt: row.updatedAt,
  }
}

route.get("/", async (c) => {
  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const rows = await db
    .select()
    .from(bodyMetricEntries)
    .where(and(eq(bodyMetricEntries.tenantId, tenantId), eq(bodyMetricEntries.userId, userId)))
    .orderBy(desc(bodyMetricEntries.date))
  return c.json({ entries: rows.map(toResponse) })
})

// Upsert by tenant+user+date — one weigh-in per day; POST updates existing row.
route.post("/", async (c) => {
  const body = CreateBodyMetricEntryInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const id = crypto.randomUUID()
  const updatedAt = Date.now()
  const measurementsJson = body.data.measurements ? JSON.stringify(body.data.measurements) : null

  await db
    .insert(bodyMetricEntries)
    .values({
      id,
      tenantId,
      userId,
      date: body.data.date,
      weightKg: body.data.weightKg,
      measurementsJson,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: [bodyMetricEntries.tenantId, bodyMetricEntries.userId, bodyMetricEntries.date],
      set: {
        weightKg: body.data.weightKg,
        measurementsJson,
        updatedAt,
      },
    })

  const [row] = await db
    .select()
    .from(bodyMetricEntries)
    .where(
      and(
        eq(bodyMetricEntries.tenantId, tenantId),
        eq(bodyMetricEntries.userId, userId),
        eq(bodyMetricEntries.date, body.data.date),
      ),
    )
    .limit(1)

  return c.json({ entry: toResponse(row!) })
})

export { route as bodyMetricsRoutes }
