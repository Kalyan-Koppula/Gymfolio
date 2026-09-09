import { Hono } from "hono"
import type { Context } from "hono"
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

/** Edge cache for the full catalog (filters still run in-process on the cached payload). */
const CATALOG_CACHE_URL = "https://gymfolio.internal/exercises-catalog-v1"
const CATALOG_CACHE_TTL_SECONDS = 3600

function parseMediaJson(raw: string | null): Exercise["media"] | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return undefined
    const o = parsed as Record<string, unknown>
    const media: NonNullable<Exercise["media"]> = {}
    for (const k of ["thumb", "start", "end"] as const) {
      if (typeof o[k] === "string" && o[k]) media[k] = o[k]
    }
    return Object.keys(media).length ? media : undefined
  } catch {
    return undefined
  }
}

function toExercise(row: typeof exercises.$inferSelect): Exercise {
  const media =
    parseMediaJson(row.mediaJson) ??
    (row.gifR2Key
      ? {
          thumb: row.gifR2Key,
        }
      : undefined)

  return ExerciseSchema.parse({
    id: row.id,
    name: row.name,
    muscleGroups: JSON.parse(row.muscleGroupsJson) as MuscleGroup[],
    equipment: JSON.parse(row.equipmentJson) as Equipment[],
    difficulty: row.difficulty,
    instructions: row.instructions,
    hasGif: row.hasGif === 1,
    media,
    youtubeStatus: row.youtubeStatus,
    youtube: row.youtubeJson ? JSON.parse(row.youtubeJson) : undefined,
  })
}

async function invalidateCatalogCache(ctx: Context<AppEnv>) {
  ctx.executionCtx.waitUntil(caches.default.delete(new Request(CATALOG_CACHE_URL)))
}

async function loadCatalog(c: Context<AppEnv>): Promise<Exercise[]> {
  const cache = caches.default
  const cacheKey = new Request(CATALOG_CACHE_URL)
  const hit = await cache.match(cacheKey)
  if (hit) {
    try {
      const body = (await hit.json()) as { exercises: Exercise[] }
      if (Array.isArray(body.exercises)) return body.exercises
    } catch {
      /* fall through */
    }
  }

  const db = getDb(c.env.DB)
  const rows = await db.select().from(exercises)
  const list = rows.map(toExercise)

  const response = new Response(JSON.stringify({ exercises: list }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CATALOG_CACHE_TTL_SECONDS}`,
    },
  })
  c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()))
  return list
}

route.get("/", async (c) => {
  const q = c.req.query("q")?.trim().toLowerCase()
  const muscle = c.req.query("muscle")
  const equipment = c.req.query("equipment")

  let list = await loadCatalog(c)

  if (q) {
    list = list.filter((r) => r.name.toLowerCase().includes(q))
  }
  if (muscle) {
    list = list.filter((r) => r.muscleGroups.includes(muscle as MuscleGroup))
  }
  if (equipment) {
    list = list.filter((r) => r.equipment.includes(equipment as Equipment))
  }

  return c.json({ exercises: list, total: list.length })
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
    invalidateCatalogCache(c)
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

  invalidateCatalogCache(c)
  const [updated] = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1)
  return c.json({ exercise: toExercise(updated!) })
})

export { route as exerciseRoutes }
