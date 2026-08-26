import { Hono } from "hono"
import { and, desc, eq, gte } from "drizzle-orm"
import { workoutLogs, workoutLogSets } from "db"
import {
  StartWorkoutInputSchema,
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

  // Resume an in-progress session for the same day/dayIndex if one exists.
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
        eq(workoutLogs.status, "completed"),
      ),
    )
    .orderBy(desc(workoutLogs.completedAt))
    .limit(limit)

  const sessions: WorkoutSessionSummary[] = rows.map((row) => ({
    id: row.id,
    dayLabel: row.dayLabel,
    date: row.date,
    completionPct: completionPct(row.setsCompleted, row.setsPlanned),
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
        eq(workoutLogs.status, "completed"),
        gte(workoutLogs.date, sinceStr),
      ),
    )

  const byWeek = new Map<string, { planned: number; completed: number }>()
  for (const row of rows) {
    const key = weekStartMonday(row.date)
    const agg = byWeek.get(key) ?? { planned: 0, completed: 0 }
    agg.planned += row.setsPlanned
    agg.completed += row.setsCompleted
    byWeek.set(key, agg)
  }

  // Build a contiguous 12-week series ending this week (empty weeks = 0%).
  const history: AdherenceWeek[] = []
  const thisMonday = weekStartMonday(todayIso())
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(`${thisMonday}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - i * 7)
    const date = d.toISOString().slice(0, 10)
    const agg = byWeek.get(date)
    history.push({
      weekLabel: `Wk ${weeks - i}`,
      date,
      completionPct: agg ? completionPct(agg.completed, agg.planned) : 0,
    })
  }

  return c.json({ history })
})

/** Next routine day index: after the last completed session's dayIndex. */
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
        eq(workoutLogs.status, "completed"),
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

/** Latest completed set per exercise — drives suggestNextWeight on the workout screen. */
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
