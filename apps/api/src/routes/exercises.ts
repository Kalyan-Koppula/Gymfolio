import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { exercises } from "db"
import { ExerciseSchema, type Exercise, type Equipment, type MuscleGroup } from "shared"
import { getDb } from "../lib/db.ts"
import { requireAuth } from "../middleware/auth.ts"
import {
  addYoutubeUnits,
  canSpendYoutubeQuota,
  getYoutubeUnitsUsed,
  searchExerciseVideo,
} from "../lib/youtube.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()
route.use(requireAuth)

function toExercise(row: typeof exercises.$inferSelect): Exercise {
  return ExerciseSchema.parse({
    id: row.id,
    name: row.name,
    muscleGroups: JSON.parse(row.muscleGroupsJson) as MuscleGroup[],
    equipment: JSON.parse(row.equipmentJson) as Equipment[],
    difficulty: row.difficulty,
    instructions: row.instructions,
    hasGif: row.hasGif === 1,
    youtubeStatus: row.youtubeStatus,
    youtube: row.youtubeJson ? JSON.parse(row.youtubeJson) : undefined,
  })
}

route.get("/", async (c) => {
  const db = getDb(c.env.DB)
  const q = c.req.query("q")?.trim().toLowerCase()
  const muscle = c.req.query("muscle")
  const equipment = c.req.query("equipment")

  let rows = await db.select().from(exercises)

  if (q) {
    rows = rows.filter((r) => r.name.toLowerCase().includes(q))
  }
  if (muscle) {
    rows = rows.filter((r) => (JSON.parse(r.muscleGroupsJson) as string[]).includes(muscle))
  }
  if (equipment) {
    rows = rows.filter((r) => (JSON.parse(r.equipmentJson) as string[]).includes(equipment))
  }

  return c.json({ exercises: rows.map(toExercise), total: rows.length })
})

route.get("/:id", async (c) => {
  const db = getDb(c.env.DB)
  const [row] = await db.select().from(exercises).where(eq(exercises.id, c.req.param("id"))).limit(1)
  if (!row) return c.json({ error: "Exercise not found" }, 404)
  return c.json({ exercise: toExercise(row) })
})

/** Lazy-fetch a YouTube reference (FR-4.5). Costs ~101 quota units (search + videos.list). */
route.post("/:id/youtube", async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param("id")
  const [row] = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1)
  if (!row) return c.json({ error: "Exercise not found" }, 404)

  if (row.youtubeStatus === "ready" && row.youtubeJson) {
    return c.json({ exercise: toExercise(row) })
  }

  const apiKey = c.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return c.json({ exercise: toExercise(row), skipped: "no_api_key" as const })
  }

  const used = await getYoutubeUnitsUsed(c.env.SESSIONS_KV)
  const searchCost = 100
  const statsCost = 1
  if (!canSpendYoutubeQuota(used, searchCost + statsCost)) {
    return c.json({ exercise: toExercise(row), skipped: "quota_cap" as const })
  }

  await db
    .update(exercises)
    .set({ youtubeStatus: "pending" })
    .where(eq(exercises.id, id))

  const ref = await searchExerciseVideo(apiKey, row.name)
  await addYoutubeUnits(c.env.SESSIONS_KV, searchCost + statsCost)

  if (!ref) {
    await db
      .update(exercises)
      .set({ youtubeStatus: "not_fetched", youtubeJson: null })
      .where(eq(exercises.id, id))
    const [updated] = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1)
    return c.json({ exercise: toExercise(updated!), skipped: "not_found" as const })
  }

  await db
    .update(exercises)
    .set({
      youtubeStatus: "ready",
      youtubeJson: JSON.stringify(ref),
    })
    .where(eq(exercises.id, id))

  const [updated] = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1)
  return c.json({ exercise: toExercise(updated!) })
})

export { route as exerciseRoutes }
