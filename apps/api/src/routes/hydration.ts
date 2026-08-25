import { Hono } from "hono"
import { and, eq } from "drizzle-orm"
import { hydrationEntries } from "db"
import { CreateHydrationEntryInputSchema } from "shared"
import { getDb } from "../lib/db.ts"
import { requireAuth } from "../middleware/auth.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()
route.use(requireAuth)

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function toResponse(row: typeof hydrationEntries.$inferSelect) {
  return { id: row.id, date: row.date, amountMl: row.amountMl, updatedAt: row.updatedAt }
}

// One row per log (a quick-add tap = one entry) — "today's total" is a derived SUM,
// never a stored/mutated running number (architecture §2 note).
route.get("/", async (c) => {
  const date = c.req.query("date") ?? todayIso()
  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)

  const rows = await db
    .select()
    .from(hydrationEntries)
    .where(
      and(eq(hydrationEntries.tenantId, tenantId), eq(hydrationEntries.userId, userId), eq(hydrationEntries.date, date)),
    )

  const totalMl = rows.reduce((sum, r) => sum + r.amountMl, 0)
  return c.json({ date, totalMl, entries: rows.map(toResponse) })
})

route.post("/", async (c) => {
  const body = CreateHydrationEntryInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const id = crypto.randomUUID()
  const updatedAt = Date.now()

  await db.insert(hydrationEntries).values({
    id,
    tenantId,
    userId,
    date: body.data.date,
    amountMl: body.data.amountMl,
    updatedAt,
  })

  return c.json({ entry: { id, date: body.data.date, amountMl: body.data.amountMl, updatedAt } }, 201)
})

export { route as hydrationRoutes }
