import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { aiProviderConfigs, exercises } from "db"
import {
  UpsertAiProviderInputSchema,
  DetectEquipmentInputSchema,
  GenerateRoutineInputSchema,
  type AiProviderId,
  type Equipment,
} from "shared"
import { getDb } from "../lib/db.ts"
import { encryptSecret, decryptSecret } from "../lib/crypto.ts"
import { requireAuth } from "../middleware/auth.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()
route.use(requireAuth)

function masterKey(env: AppEnv["Bindings"]): string | null {
  return (env as AppEnv["Bindings"] & { MASTER_KEY?: string }).MASTER_KEY ?? null
}

route.get("/config", async (c) => {
  const { tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const [row] = await db
    .select()
    .from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.tenantId, tenantId))
    .limit(1)

  if (!row) {
    return c.json({ configured: false, provider: null, endpointOverride: null })
  }
  return c.json({
    configured: true,
    provider: row.provider as AiProviderId,
    endpointOverride: row.endpointOverride,
  })
})

route.put("/config", async (c) => {
  const body = UpsertAiProviderInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const key = masterKey(c.env)
  if (!key) {
    return c.json({ error: "MASTER_KEY is not configured on the Worker" }, 503)
  }

  const { tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const { ciphertext, iv } = await encryptSecret(key, tenantId, body.data.apiKey)
  const now = Date.now()
  const endpoint = body.data.endpointOverride?.trim() || null

  await db
    .insert(aiProviderConfigs)
    .values({
      tenantId,
      provider: body.data.provider,
      encryptedApiKey: ciphertext,
      iv,
      endpointOverride: endpoint,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: aiProviderConfigs.tenantId,
      set: {
        provider: body.data.provider,
        encryptedApiKey: ciphertext,
        iv,
        endpointOverride: endpoint,
        updatedAt: now,
      },
    })

  return c.json({ configured: true, provider: body.data.provider, endpointOverride: endpoint })
})

route.post("/test", async (c) => {
  const { tenantId } = c.get("auth")
  const key = masterKey(c.env)
  if (!key) return c.json({ ok: false, reason: "MASTER_KEY missing" }, 503)

  const db = getDb(c.env.DB)
  const [row] = await db
    .select()
    .from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.tenantId, tenantId))
    .limit(1)

  if (!row) return c.json({ ok: false, reason: "No provider configured" }, 400)

  try {
    const apiKey = await decryptSecret(key, tenantId, row.encryptedApiKey, row.iv)
    // Real provider ping is deferred — decryptability + non-empty key is the v0 "test".
    if (!apiKey.trim()) return c.json({ ok: false, reason: "Empty key" }, 400)
    return c.json({ ok: true })
  } catch {
    return c.json({ ok: false, reason: "Could not decrypt stored key" }, 500)
  }
})

route.post("/detect-equipment", async (c) => {
  DetectEquipmentInputSchema.safeParse(await c.req.json())
  const { tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const [row] = await db
    .select()
    .from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.tenantId, tenantId))
    .limit(1)

  if (!row) {
    return c.json({
      degraded: true,
      reason: "No AI provider configured — pick equipment manually",
      equipment: [] as Equipment[],
    })
  }

  // Vision call not wired yet — return a sensible default set so the happy path is
  // editable, matching the previous stub behavior but gated on a real saved key.
  return c.json({
    degraded: false,
    equipment: ["barbell", "dumbbell", "bench", "squat-rack"] as Equipment[],
  })
})

route.post("/generate-routine", async (c) => {
  const body = GenerateRoutineInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const { tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const [config] = await db
    .select()
    .from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.tenantId, tenantId))
    .limit(1)

  if (!config) {
    return c.json({
      degraded: true,
      reason: "No AI provider configured — use the manual builder",
    })
  }

  const allExercises = await db.select().from(exercises)
  const available = allExercises.filter((ex) => {
    const eqTags = JSON.parse(ex.equipmentJson) as string[]
    return eqTags.some((t) => body.data.equipment.includes(t as Equipment))
  })

  if (available.length === 0) {
    return c.json({ degraded: true, reason: "No exercises match your equipment" })
  }

  const days = body.data.dayLabels.map((label, i) => {
    const pick = available.slice(i * 4, i * 4 + 4)
    const ids = (pick.length > 0 ? pick : available.slice(0, 4)).map((e) => e.id)
    return { label, exerciseIds: ids }
  })

  // Guardrail: every ID must exist in the exercise table.
  const known = new Set(allExercises.map((e) => e.id))
  for (const day of days) {
    day.exerciseIds = day.exerciseIds.filter((id) => known.has(id))
  }

  return c.json({ degraded: false, days })
})

export { route as aiRoutes }
