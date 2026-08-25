import { Hono } from "hono"
import { and, eq } from "drizzle-orm"
import { macroEntries } from "db"
import { UpsertMacroEntryInputSchema } from "shared"
import { getDb } from "../lib/db.ts"
import { requireAuth } from "../middleware/auth.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()
route.use(requireAuth)

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function toResponse(row: typeof macroEntries.$inferSelect) {
  return { date: row.date, calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat, updatedAt: row.updatedAt }
}

route.get("/", async (c) => {
  const date = c.req.query("date") ?? todayIso()
  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)

  const [row] = await db
    .select()
    .from(macroEntries)
    .where(and(eq(macroEntries.tenantId, tenantId), eq(macroEntries.userId, userId), eq(macroEntries.date, date)))
    .limit(1)

  if (!row) return c.json({ entry: null })
  return c.json({ entry: toResponse(row) })
})

// Daily upsert — one row per date, plain numeric totals only.
route.put("/", async (c) => {
  const body = UpsertMacroEntryInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const updatedAt = Date.now()

  await db
    .insert(macroEntries)
    .values({ id: crypto.randomUUID(), tenantId, userId, ...body.data, updatedAt })
    .onConflictDoUpdate({
      target: [macroEntries.userId, macroEntries.date],
      set: {
        calories: body.data.calories,
        protein: body.data.protein,
        carbs: body.data.carbs,
        fat: body.data.fat,
        updatedAt,
      },
    })

  return c.json({ entry: { ...body.data, updatedAt } })
})

export { route as macrosRoutes }
