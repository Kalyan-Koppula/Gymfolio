import { Hono } from "hono"
import { and, eq } from "drizzle-orm"
import { themePreferences } from "db"
import {
  UpsertThemePreferenceInputSchema,
  type ThemePreference,
  type ThemePalette,
  type ThemeMode,
  type FontPairing,
} from "shared"
import { getDb } from "../lib/db.ts"
import { requireAuth } from "../middleware/auth.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()
route.use(requireAuth)

function toResponse(row: typeof themePreferences.$inferSelect): ThemePreference {
  return {
    themeId: row.themeId as ThemePalette,
    mode: row.mode as ThemeMode,
    radius: row.radius,
    fontPairing: row.fontPairing as FontPairing,
    updatedAt: row.updatedAt,
  }
}

const DEFAULTS: ThemePreference = {
  themeId: "zinc",
  mode: "system",
  radius: 0.625,
  fontPairing: "sans",
  updatedAt: 0,
}

route.get("/", async (c) => {
  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const [row] = await db
    .select()
    .from(themePreferences)
    .where(and(eq(themePreferences.userId, userId), eq(themePreferences.tenantId, tenantId)))
    .limit(1)
  return c.json({ theme: row ? toResponse(row) : DEFAULTS })
})

route.put("/", async (c) => {
  const body = UpsertThemePreferenceInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const { userId, tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const now = Date.now()
  const values = {
    userId,
    tenantId,
    themeId: body.data.themeId,
    mode: body.data.mode,
    radius: body.data.radius,
    fontPairing: body.data.fontPairing,
    updatedAt: now,
  }

  await db.insert(themePreferences).values(values).onConflictDoUpdate({
    target: themePreferences.userId,
    set: {
      themeId: values.themeId,
      mode: values.mode,
      radius: values.radius,
      fontPairing: values.fontPairing,
      updatedAt: now,
    },
  })

  return c.json({ theme: { ...body.data, updatedAt: now } satisfies ThemePreference })
})

export { route as themeRoutes }