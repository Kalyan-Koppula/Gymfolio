import { Hono } from "hono"
import { and, desc, eq, gte, inArray } from "drizzle-orm"
import { workoutLogs, workoutLogSets } from "db"
import {
  StartWorkoutInputSchema,
  SkipWorkoutInputSchema,
  LogWorkoutSetInputSchema,
  type WorkoutLog,
  type WorkoutLogSet,
  type WorkoutSessionSummary,
  type AdherenceWeek,
  type LastPerformance,
} from "shared"
import { getDb } from "../lib/db.ts"
import { requireAuth } from "../middleware/auth.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()
route.use(requireAuth)

function completionPct(setsCompleted: number, setsPlanned: number) {
  if (setsPlanned <= 0) return 0
  return Math.min(100, Math.round((setsCompleted / setsPlanned) * 100))
}

function toLog(row: typeof workoutLogs.$inferSelect, sets?: WorkoutLogSet[]): WorkoutLog {
  return {
    id: row.id,
    date: row.date,
    dayLabel: row.dayLabel,
    dayIndex: row.dayIndex,
    status: row.status as WorkoutLog["status"],
    setsPlanned: row.setsPlanned,
    setsCompleted: row.setsCompleted,
    completionPct: completionPct(row.setsCompleted, row.setsPlanned),
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    updatedAt: row.updatedAt,
    sets,
  }
}

function toSet(row: typeof workoutLogSets.$inferSelect): WorkoutLogSet {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    setIndex: row.setIndex,
    actualReps: row.actualReps,
    actualWeightKg: row.actualWeightKg,
    updatedAt: row.updatedAt,
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Monday (UTC) of the ISO week containing `date`. */
function weekStartMonday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const day = d.getUTCDay() // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

route.post("/start", async (c) => {
  const body = StartWorkoutInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const now = Date.now()
  const id = crypto.randomUUID()

  const [existing] = await db
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.tenantId, tenantId),
        eq(workoutLogs.date, body.data.date),
        eq(workoutLogs.dayIndex, body.data.dayIndex),
        eq(workoutLogs.status, "in_progress"),
      ),
    )
    .limit(1)

  if (existing) {
    const sets = await db
      .select()
      .from(workoutLogSets)
      .where(eq(workoutLogSets.workoutLogId, existing.id))
    return c.json({ workout: toLog(existing, sets.map(toSet)) })
  }

  await db.insert(workoutLogs).values({
    id,
    tenantId,
    userId,
    date: body.data.date,
    dayLabel: body.data.dayLabel,
    dayIndex: body.data.dayIndex,
    status: "in_progress",
    setsPlanned: body.data.setsPlanned,
    setsCompleted: 0,
    startedAt: now,
    completedAt: null,
    updatedAt: now,
  })

  return c.json(
    {
      workout: toLog({
        id,
        tenantId,
        userId,
        date: body.data.date,
        dayLabel: body.data.dayLabel,
        dayIndex: body.data.dayIndex,
        status: "in_progress",
        setsPlanned: body.data.setsPlanned,
        setsCompleted: 0,
        startedAt: now,
        completedAt: null,
        updatedAt: now,
      }),
    },
    201,
  )
})

/** Skip today's routine day — advances cycle like a completion, no sets logged. */
route.post("/skip", async (c) => {
  const body = SkipWorkoutInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const now = Date.now()
  const id = crypto.randomUUID()

  // If there's an in-progress session for this slot, convert it to skipped (drop sets).
  const [existing] = await db
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.tenantId, tenantId),
        eq(workoutLogs.date, body.data.date),
        eq(workoutLogs.dayIndex, body.data.dayIndex),
        inArray(workoutLogs.status, ["in_progress", "completed", "skipped"]),
      ),
    )
    .limit(1)

  if (existing?.status === "skipped") {
    return c.json({ workout: toLog(existing) })
  }
  if (existing?.status === "completed") {
    return c.json({ error: "Day already completed" }, 400)
  }

  if (existing?.status === "in_progress") {
    await db.delete(workoutLogSets).where(eq(workoutLogSets.workoutLogId, existing.id))
    await db
      .update(workoutLogs)
      .set({
        status: "skipped",
        setsCompleted: 0,
        setsPlanned: 0,
        completedAt: now,
        updatedAt: now,
        dayLabel: body.data.dayLabel,
      })
      .where(eq(workoutLogs.id, existing.id))
    return c.json({
      workout: toLog({
        ...existing,
        status: "skipped",
        setsCompleted: 0,
        setsPlanned: 0,
        completedAt: now,
        updatedAt: now,
        dayLabel: body.data.dayLabel,
      }),
    })
  }

  await db.insert(workoutLogs).values({
    id,
    tenantId,
    userId,
    date: body.data.date,
    dayLabel: body.data.dayLabel,
    dayIndex: body.data.dayIndex,
    status: "skipped",
    setsPlanned: 0,
    setsCompleted: 0,
    startedAt: now,
    completedAt: now,
    updatedAt: now,
  })

  return c.json(
    {
      workout: toLog({
        id,
        tenantId,
        userId,
        date: body.data.date,
        dayLabel: body.data.dayLabel,
        dayIndex: body.data.dayIndex,
        status: "skipped",
        setsPlanned: 0,
        setsCompleted: 0,
        startedAt: now,
        completedAt: now,
        updatedAt: now,
      }),
    },
    201,
  )
})

route.post("/:id/sets", async (c) => {
  const body = LogWorkoutSetInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const id = c.req.param("id")
  const now = Date.now()

  const [log] = await db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, userId), eq(workoutLogs.tenantId, tenantId)))
    .limit(1)

  if (!log) return c.json({ error: "Workout not found" }, 404)
  if (log.status !== "in_progress") return c.json({ error: "Workout already completed" }, 400)

  const setId = crypto.randomUUID()
  await db.insert(workoutLogSets).values({
    id: setId,
    workoutLogId: id,
    exerciseId: body.data.exerciseId,
    setIndex: body.data.setIndex,
    actualReps: body.data.actualReps,
    actualWeightKg: body.data.actualWeightKg,
    updatedAt: now,
  })

  const setsCompleted = log.setsCompleted + 1
  await db
    .update(workoutLogs)
    .set({ setsCompleted, updatedAt: now })
    .where(eq(workoutLogs.id, id))

  return c.json(
    {
      set: toSet({
        id: setId,
        workoutLogId: id,
        exerciseId: body.data.exerciseId,
        setIndex: body.data.setIndex,
        actualReps: body.data.actualReps,
        actualWeightKg: body.data.actualWeightKg,
        updatedAt: now,
      }),
      setsCompleted,
    },
    201,
  )
})

route.post("/:id/finish", async (c) => {
  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const id = c.req.param("id")
  const now = Date.now()

  const [log] = await db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, userId), eq(workoutLogs.tenantId, tenantId)))
    .limit(1)

  if (!log) return c.json({ error: "Workout not found" }, 404)

  await db
    .update(workoutLogs)
    .set({ status: "completed", completedAt: now, updatedAt: now })
    .where(eq(workoutLogs.id, id))

  const sets = await db.select().from(workoutLogSets).where(eq(workoutLogSets.workoutLogId, id))
  return c.json({
    workout: toLog({ ...log, status: "completed", completedAt: now, updatedAt: now }, sets.map(toSet)),
  })
})

/** Current in-progress session — drives the resume mini-bar. */
route.get("/in-progress", async (c) => {
  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)

  const [row] = await db
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.tenantId, tenantId),
        eq(workoutLogs.status, "in_progress"),
      ),
    )
    .orderBy(desc(workoutLogs.startedAt))
    .limit(1)

  if (!row) return c.json({ workout: null })

  const sets = await db.select().from(workoutLogSets).where(eq(workoutLogSets.workoutLogId, row.id))
  return c.json({ workout: toLog(row, sets.map(toSet)) })
})

route.get("/recent", async (c) => {
  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const limit = Math.min(Number(c.req.query("limit") ?? 10), 50)

  const rows = await db
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.tenantId, tenantId),
        inArray(workoutLogs.status, ["completed", "skipped"]),
      ),
    )
    .orderBy(desc(workoutLogs.completedAt))
    .limit(limit)

  const sessions: WorkoutSessionSummary[] = rows.map((row) => ({
    id: row.id,
    dayLabel: row.dayLabel,
    date: row.date,
    status: row.status as "completed" | "skipped",
    completionPct: row.status === "skipped" ? 0 : completionPct(row.setsCompleted, row.setsPlanned),
    sets: row.setsCompleted,
    setsPlanned: row.setsPlanned,
  }))

  return c.json({ sessions })
})

route.get("/adherence", async (c) => {
  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const weeks = Math.min(Number(c.req.query("weeks") ?? 12), 52)

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - weeks * 7)
  const sinceStr = since.toISOString().slice(0, 10)

  const rows = await db
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.tenantId, tenantId),
        inArray(workoutLogs.status, ["completed", "skipped"]),
        gte(workoutLogs.date, sinceStr),
      ),
    )

  const byWeek = new Map<string, { completed: number; skipped: number }>()
  for (const row of rows) {
    const key = weekStartMonday(row.date)
    const agg = byWeek.get(key) ?? { completed: 0, skipped: 0 }
    if (row.status === "skipped") agg.skipped += 1
    else agg.completed += 1
    byWeek.set(key, agg)
  }

  const history: AdherenceWeek[] = []
  const thisMonday = weekStartMonday(todayIso())
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(`${thisMonday}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - i * 7)
    const date = d.toISOString().slice(0, 10)
    const agg = byWeek.get(date)
    const sessionsCompleted = agg?.completed ?? 0
    const sessionsSkipped = agg?.skipped ?? 0
    const sessionsPlanned = sessionsCompleted + sessionsSkipped
    history.push({
      weekLabel: `Wk ${weeks - i}`,
      date,
      sessionsPlanned,
      sessionsCompleted,
      sessionsSkipped,
      // null = no-data yet for that week (not the same as 0% from all skips)
      completionPct:
        sessionsPlanned === 0 ? null : Math.round((sessionsCompleted / sessionsPlanned) * 100),
    })
  }

  return c.json({ history })
})

/** Next routine day index after last completed OR skipped session. */
route.get("/cycle-step", async (c) => {
  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)

  const [last] = await db
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.tenantId, tenantId),
        inArray(workoutLogs.status, ["completed", "skipped"]),
      ),
    )
    .orderBy(desc(workoutLogs.completedAt))
    .limit(1)

  const dayCount = Number(c.req.query("dayCount") ?? 0)
  if (!last || dayCount <= 0) {
    return c.json({ cycleStep: 0, lastDayIndex: null as number | null })
  }

  return c.json({
    cycleStep: (last.dayIndex + 1) % dayCount,
    lastDayIndex: last.dayIndex,
  })
})

route.get("/last-performance", async (c) => {
  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)

  const rows = await db
    .select({
      exerciseId: workoutLogSets.exerciseId,
      actualReps: workoutLogSets.actualReps,
      actualWeightKg: workoutLogSets.actualWeightKg,
      date: workoutLogs.date,
      updatedAt: workoutLogSets.updatedAt,
    })
    .from(workoutLogSets)
    .innerJoin(workoutLogs, eq(workoutLogSets.workoutLogId, workoutLogs.id))
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.tenantId, tenantId),
        eq(workoutLogs.status, "completed"),
      ),
    )
    .orderBy(desc(workoutLogSets.updatedAt))

  const seen = new Set<string>()
  const performances: LastPerformance[] = []
  for (const row of rows) {
    if (seen.has(row.exerciseId)) continue
    seen.add(row.exerciseId)
    performances.push({
      exerciseId: row.exerciseId,
      reps: row.actualReps,
      weightKg: row.actualWeightKg,
      date: row.date,
    })
  }

  return c.json({ performances })
})

export { route as workoutRoutes }