import { Hono } from "hono"
import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm"
import { exercises, workoutLogs, workoutLogSets } from "db"
import {
  StartWorkoutInputSchema,
  SkipWorkoutInputSchema,
  LogWorkoutSetInputSchema,
  UpdateWorkoutSetInputSchema,
  type WorkoutLog,
  type WorkoutLogSet,
  type WorkoutSessionSummary,
  type AdherenceWeek,
  type LastPerformance,
  type ExerciseProgressPoint,
  type MuscleVolumeEntry,
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
    skipped: row.skipped === 1,
    updatedAt: row.updatedAt,
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

type Db = ReturnType<typeof getDb>

/**
 * At most one in-progress session per user. Orphans appear from React StrictMode
 * double-mounting /start (two inserts before either can see the other).
 */
async function abandonInProgressExcept(
  db: Db,
  userId: string,
  tenantId: string,
  keepId?: string,
) {
  const conditions = [
    eq(workoutLogs.userId, userId),
    eq(workoutLogs.tenantId, tenantId),
    eq(workoutLogs.status, "in_progress"),
  ]
  if (keepId) conditions.push(ne(workoutLogs.id, keepId))

  const rows = await db
    .select()
    .from(workoutLogs)
    .where(and(...conditions))
  for (const row of rows) {
    await db.delete(workoutLogSets).where(eq(workoutLogSets.workoutLogId, row.id))
    await db.delete(workoutLogs).where(eq(workoutLogs.id, row.id))
  }
}

/** Drop in-progress rows that are shadowed by a completed log for the same calendar slot,
 * or left open from a previous calendar day. */
async function abandonStaleInProgressDuplicates(db: Db, userId: string, tenantId: string) {
  const today = todayIso()
  const open = await db
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.tenantId, tenantId),
        eq(workoutLogs.status, "in_progress"),
      ),
    )
  for (const row of open) {
    if (row.date < today) {
      await db.delete(workoutLogSets).where(eq(workoutLogSets.workoutLogId, row.id))
      await db.delete(workoutLogs).where(eq(workoutLogs.id, row.id))
      continue
    }
    const [done] = await db
      .select({ id: workoutLogs.id })
      .from(workoutLogs)
      .where(
        and(
          eq(workoutLogs.userId, userId),
          eq(workoutLogs.tenantId, tenantId),
          eq(workoutLogs.date, row.date),
          eq(workoutLogs.dayIndex, row.dayIndex),
          eq(workoutLogs.status, "completed"),
        ),
      )
      .limit(1)
    if (done) {
      await db.delete(workoutLogSets).where(eq(workoutLogSets.workoutLogId, row.id))
      await db.delete(workoutLogs).where(eq(workoutLogs.id, row.id))
    }
  }
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

  // Block a second session on a calendar day that already has a completed workout.
  const [completedToday] = await db
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.tenantId, tenantId),
        eq(workoutLogs.date, body.data.date),
        eq(workoutLogs.status, "completed"),
      ),
    )
    .limit(1)
  if (completedToday) {
    return c.json({ error: "Workout already completed for this date" }, 400)
  }

  await abandonStaleInProgressDuplicates(db, userId, tenantId)

  // Prefer an existing open session for this slot (most sets logged wins).
  const sameSlot = await db
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
    .orderBy(desc(workoutLogs.setsCompleted), desc(workoutLogs.startedAt))

  if (sameSlot.length > 0) {
    const keep = sameSlot[0]
    // Drop StrictMode duplicates for this slot, and any other day's open session.
    await abandonInProgressExcept(db, userId, tenantId, keep.id)
    const sets = await db
      .select()
      .from(workoutLogSets)
      .where(eq(workoutLogSets.workoutLogId, keep.id))
    return c.json({ workout: toLog(keep, sets.map(toSet)) })
  }

  // Starting a new slot — close any leftover open sessions from earlier days.
  await abandonInProgressExcept(db, userId, tenantId)

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

  const [existingSet] = await db
    .select()
    .from(workoutLogSets)
    .where(
      and(
        eq(workoutLogSets.workoutLogId, id),
        eq(workoutLogSets.exerciseId, body.data.exerciseId),
        eq(workoutLogSets.setIndex, body.data.setIndex),
      ),
    )
    .limit(1)

  if (existingSet) {
    await db
      .update(workoutLogSets)
      .set({
        actualReps: body.data.actualReps,
        actualWeightKg: body.data.actualWeightKg,
        skipped: body.data.skipped ? 1 : 0,
        updatedAt: now,
      })
      .where(eq(workoutLogSets.id, existingSet.id))
    return c.json({
      set: toSet({
        ...existingSet,
        actualReps: body.data.actualReps,
        actualWeightKg: body.data.actualWeightKg,
        skipped: body.data.skipped ? 1 : 0,
        updatedAt: now,
      }),
      setsCompleted: log.setsCompleted,
    })
  }

  const setId = crypto.randomUUID()
  await db.insert(workoutLogSets).values({
    id: setId,
    workoutLogId: id,
    exerciseId: body.data.exerciseId,
    setIndex: body.data.setIndex,
    actualReps: body.data.actualReps,
    actualWeightKg: body.data.actualWeightKg,
    skipped: body.data.skipped ? 1 : 0,
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
        skipped: body.data.skipped ? 1 : 0,
        updatedAt: now,
      }),
      setsCompleted,
    },
    201,
  )
})

/** Correct an already-logged set (active session or post-session history). */
route.patch("/:id/sets/:setId", async (c) => {
  const body = UpdateWorkoutSetInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)
  if (body.data.actualReps === undefined && body.data.actualWeightKg === undefined) {
    return c.json({ error: "Nothing to update" }, 400)
  }

  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const workoutId = c.req.param("id")
  const setId = c.req.param("setId")
  const now = Date.now()

  const [log] = await db
    .select()
    .from(workoutLogs)
    .where(
      and(eq(workoutLogs.id, workoutId), eq(workoutLogs.userId, userId), eq(workoutLogs.tenantId, tenantId)),
    )
    .limit(1)
  if (!log) return c.json({ error: "Workout not found" }, 404)
  if (log.status === "skipped") return c.json({ error: "Skipped sessions have no sets" }, 400)

  const [row] = await db
    .select()
    .from(workoutLogSets)
    .where(and(eq(workoutLogSets.id, setId), eq(workoutLogSets.workoutLogId, workoutId)))
    .limit(1)
  if (!row) return c.json({ error: "Set not found" }, 404)

  const next = {
    actualReps: body.data.actualReps ?? row.actualReps,
    actualWeightKg: body.data.actualWeightKg ?? row.actualWeightKg,
    updatedAt: now,
  }
  await db.update(workoutLogSets).set(next).where(eq(workoutLogSets.id, setId))
  return c.json({ set: toSet({ ...row, ...next }) })
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

  // Drop StrictMode duplicate open sessions for this slot (and any other leftovers).
  await abandonInProgressExcept(db, userId, tenantId)

  const sets = await db.select().from(workoutLogSets).where(eq(workoutLogSets.workoutLogId, id))
  return c.json({
    workout: toLog({ ...log, status: "completed", completedAt: now, updatedAt: now }, sets.map(toSet)),
  })
})

/** Current in-progress session — drives the resume mini-bar. */
route.get("/in-progress", async (c) => {
  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)

  await abandonStaleInProgressDuplicates(db, userId, tenantId)

  const open = await db
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.tenantId, tenantId),
        eq(workoutLogs.status, "in_progress"),
      ),
    )
    .orderBy(desc(workoutLogs.setsCompleted), desc(workoutLogs.startedAt))

  if (open.length === 0) return c.json({ workout: null })

  const keep = open[0]
  if (open.length > 1) {
    await abandonInProgressExcept(db, userId, tenantId, keep.id)
  }

  const sets = await db.select().from(workoutLogSets).where(eq(workoutLogSets.workoutLogId, keep.id))
  return c.json({ workout: toLog(keep, sets.map(toSet)) })
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

  // Newest completed sets first — group by exercise, keep every set from the newest session date.
  const rows = await db
    .select({
      exerciseId: workoutLogSets.exerciseId,
      setIndex: workoutLogSets.setIndex,
      actualReps: workoutLogSets.actualReps,
      actualWeightKg: workoutLogSets.actualWeightKg,
      date: workoutLogs.date,
      workoutId: workoutLogs.id,
      updatedAt: workoutLogSets.updatedAt,
    })
    .from(workoutLogSets)
    .innerJoin(workoutLogs, eq(workoutLogSets.workoutLogId, workoutLogs.id))
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.tenantId, tenantId),
        eq(workoutLogs.status, "completed"),
        sql`coalesce(${workoutLogSets.skipped}, 0) = 0`,
      ),
    )
    .orderBy(desc(workoutLogs.completedAt), desc(workoutLogSets.updatedAt))

  const byExercise = new Map<string, LastPerformance>()
  for (const row of rows) {
    const existing = byExercise.get(row.exerciseId)
    if (!existing) {
      byExercise.set(row.exerciseId, {
        exerciseId: row.exerciseId,
        date: row.date,
        sets: [
          { setIndex: row.setIndex, reps: row.actualReps, weightKg: row.actualWeightKg },
        ],
      })
      continue
    }
    // Only include sets from the same (most recent) session date for this exercise.
    if (existing.date !== row.date) continue
    if (existing.sets.some((s) => s.setIndex === row.setIndex)) continue
    existing.sets.push({ setIndex: row.setIndex, reps: row.actualReps, weightKg: row.actualWeightKg })
  }

  for (const perf of byExercise.values()) {
    perf.sets.sort((a, b) => a.setIndex - b.setIndex)
  }

  return c.json({ performances: [...byExercise.values()] })
})

/** Epley estimated 1RM: weight × (1 + reps/30). */
function epley1Rm(weightKg: number, reps: number) {
  return weightKg * (1 + reps / 30)
}

/**
 * Per-session aggregates for one exercise — completed WorkoutLogSets grouped by session date.
 * Query: GET /api/workouts/progress/exercise?exerciseId=
 */
route.get("/progress/exercise", async (c) => {
  const exerciseId = c.req.query("exerciseId")?.trim()
  if (!exerciseId) return c.json({ error: "exerciseId is required" }, 400)

  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)

  const rows = await db
    .select({
      workoutId: workoutLogs.id,
      date: workoutLogs.date,
      actualReps: workoutLogSets.actualReps,
      actualWeightKg: workoutLogSets.actualWeightKg,
      completedAt: workoutLogs.completedAt,
    })
    .from(workoutLogSets)
    .innerJoin(workoutLogs, eq(workoutLogSets.workoutLogId, workoutLogs.id))
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.tenantId, tenantId),
        eq(workoutLogs.status, "completed"),
        eq(workoutLogSets.exerciseId, exerciseId),
        sql`coalesce(${workoutLogSets.skipped}, 0) = 0`,
      ),
    )
    .orderBy(desc(workoutLogs.completedAt))

  // Group by workout session (one point per session date / log).
  const byWorkout = new Map<
    string,
    { date: string; completedAt: number | null; sets: { reps: number; weightKg: number }[] }
  >()
  for (const row of rows) {
    const agg = byWorkout.get(row.workoutId) ?? {
      date: row.date,
      completedAt: row.completedAt,
      sets: [],
    }
    agg.sets.push({ reps: row.actualReps, weightKg: row.actualWeightKg })
    byWorkout.set(row.workoutId, agg)
  }

  const points: ExerciseProgressPoint[] = [...byWorkout.entries()]
    .map(([workoutId, agg]) => {
      let topSetWeightKg = 0
      let estimated1RmKg = 0
      let totalVolumeKg = 0
      for (const s of agg.sets) {
        topSetWeightKg = Math.max(topSetWeightKg, s.weightKg)
        estimated1RmKg = Math.max(estimated1RmKg, epley1Rm(s.weightKg, s.reps))
        totalVolumeKg += s.weightKg * s.reps
      }
      return {
        date: agg.date,
        workoutId,
        topSetWeightKg: Math.round(topSetWeightKg * 10) / 10,
        estimated1RmKg: Math.round(estimated1RmKg * 10) / 10,
        totalVolumeKg: Math.round(totalVolumeKg * 10) / 10,
        completedAt: agg.completedAt ?? 0,
      }
    })
    .sort((a, b) => a.completedAt - b.completedAt)
    .map(({ completedAt: _completedAt, ...point }) => point)

  return c.json({ exerciseId, points })
})

/**
 * Sets per muscle group over a lookback window.
 * Each set counts toward EVERY muscle group on the exercise (muscle_groups_json).
 * Skipped sets are excluded. Includes completed + in-progress sessions (not skipped days).
 * Query: GET /api/workouts/progress/muscle-volume?days=7|30|90|365|all
 */
route.get("/progress/muscle-volume", async (c) => {
  const daysParam = c.req.query("days") ?? "30"
  const days =
    daysParam === "all" || daysParam === "Infinity"
      ? null
      : Math.min(Math.max(1, Number(daysParam) || 30), 3650)

  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)

  let sinceStr: string | null = null
  if (days != null) {
    const since = new Date()
    since.setUTCDate(since.getUTCDate() - days)
    sinceStr = since.toISOString().slice(0, 10)
  }

  const conditions = [
    eq(workoutLogs.userId, userId),
    eq(workoutLogs.tenantId, tenantId),
    ne(workoutLogs.status, "skipped"),
    // Prefer column when migrated; treat missing/0 as not skipped.
    sql`coalesce(${workoutLogSets.skipped}, 0) = 0`,
  ]
  if (sinceStr) conditions.push(gte(workoutLogs.date, sinceStr))

  const rows = await db
    .select({
      exerciseId: workoutLogSets.exerciseId,
      muscleGroupsJson: exercises.muscleGroupsJson,
    })
    .from(workoutLogSets)
    .innerJoin(workoutLogs, eq(workoutLogSets.workoutLogId, workoutLogs.id))
    .leftJoin(exercises, eq(workoutLogSets.exerciseId, exercises.id))
    .where(and(...conditions))

  const counts = new Map<string, number>()
  for (const row of rows) {
    let groups: string[] = []
    if (row.muscleGroupsJson) {
      try {
        groups = JSON.parse(row.muscleGroupsJson) as string[]
      } catch {
        continue
      }
    }
    if (!Array.isArray(groups) || groups.length === 0) continue
    for (const g of groups) {
      if (typeof g !== "string" || !g) continue
      counts.set(g, (counts.get(g) ?? 0) + 1)
    }
  }

  const volumes: MuscleVolumeEntry[] = [...counts.entries()]
    .map(([muscleGroup, sets]) => ({ muscleGroup, sets }))
    .sort((a, b) => b.sets - a.sets)

  return c.json({ days, volumes })
})

/** Calendar-day status for Today — completed blocks Start; skipped does not. */
route.get("/for-date", async (c) => {
  const date = c.req.query("date") ?? todayIso()
  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)

  const rows = await db
    .select()
    .from(workoutLogs)
    .where(
      and(eq(workoutLogs.userId, userId), eq(workoutLogs.tenantId, tenantId), eq(workoutLogs.date, date)),
    )
    .orderBy(desc(workoutLogs.updatedAt))

  const completed = rows.find((r) => r.status === "completed") ?? null
  const skipped = rows.find((r) => r.status === "skipped") ?? null
  const inProgress = rows.find((r) => r.status === "in_progress") ?? null

  async function withSets(row: typeof workoutLogs.$inferSelect | null) {
    if (!row) return null
    const sets = await db.select().from(workoutLogSets).where(eq(workoutLogSets.workoutLogId, row.id))
    return toLog(row, sets.map(toSet))
  }

  return c.json({
    date,
    completed: await withSets(completed),
    skipped: await withSets(skipped),
    inProgress: await withSets(inProgress),
  })
})

/** Parametric GET last — must not precede static paths like /in-progress or /for-date. */
route.get("/:id", async (c) => {
  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const id = c.req.param("id")
  const [log] = await db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, userId), eq(workoutLogs.tenantId, tenantId)))
    .limit(1)
  if (!log) return c.json({ error: "Workout not found" }, 404)
  const sets = await db.select().from(workoutLogSets).where(eq(workoutLogSets.workoutLogId, id))
  return c.json({ workout: toLog(log, sets.map(toSet)) })
})

export { route as workoutRoutes }