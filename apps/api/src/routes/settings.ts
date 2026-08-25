import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { userSettings } from "db"
import { UpsertUserSettingsInputSchema, type Equipment, type UserSettings } from "shared"
import { getDb } from "../lib/db.ts"
import { requireAuth } from "../middleware/auth.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()
route.use(requireAuth)

const DEFAULTS: UserSettings = {
  hydrationGoalMl: 3000,
  macroMode: "computed",
  bodyweightKg: null,
  macroTargets: { calories: 2400, protein: 180, carbs: 240, fat: 70 },
  equipment: [],
  onboardingCompletedAt: null,
}

function toResponse(row: typeof userSettings.$inferSelect): UserSettings {
  return {
    hydrationGoalMl: row.hydrationGoalMl,
    macroMode: row.macroMode as UserSettings["macroMode"],
    bodyweightKg: row.bodyweightKg,
    macroTargets: { calories: row.macroCalories, protein: row.macroProtein, carbs: row.macroCarbs, fat: row.macroFat },
    equipment: JSON.parse(row.equipmentJson) as Equipment[],
    onboardingCompletedAt: row.onboardingCompletedAt,
  }
}

route.get("/", async (c) => {
  const { userId } = c.get("auth")
  const db = getDb(c.env.DB)
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)
  return c.json(row ? toResponse(row) : DEFAULTS)
})

route.put("/", async (c) => {
  const body = UpsertUserSettingsInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const updatedAt = Date.now()

  const [existing] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)
  const onboardingCompletedAt = existing?.onboardingCompletedAt ?? (body.data.completeOnboarding ? updatedAt : null)

  const values = {
    userId,
    tenantId,
    hydrationGoalMl: body.data.hydrationGoalMl,
    macroMode: body.data.macroMode,
    bodyweightKg: body.data.bodyweightKg ?? null,
    macroCalories: body.data.macroTargets.calories,
    macroProtein: body.data.macroTargets.protein,
    macroCarbs: body.data.macroTargets.carbs,
    macroFat: body.data.macroTargets.fat,
    equipmentJson: JSON.stringify(body.data.equipment),
    onboardingCompletedAt,
    updatedAt,
  }

  await db
    .insert(userSettings)
    .values(values)
    .onConflictDoUpdate({ target: userSettings.userId, set: values })

  return c.json({
    hydrationGoalMl: values.hydrationGoalMl,
    macroMode: values.macroMode,
    bodyweightKg: values.bodyweightKg,
    macroTargets: body.data.macroTargets,
    equipment: body.data.equipment,
    onboardingCompletedAt: values.onboardingCompletedAt,
  } satisfies UserSettings)
})

export { route as settingsRoutes }
