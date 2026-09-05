import {
  aiProviderConfigs,
  exercises,
} from "db"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import {
  DEFAULT_OPENROUTER_MODEL,
  DetectEquipmentInputSchema,
  EquipmentSchema,
  GenerateRoutineInputSchema,
  UpsertAiProviderInputSchema,
  type AiProviderId,
  type Equipment,
} from "shared"
import {
  addOpenRouterCall,
  canSpendOpenRouterQuota,
  createAIProvider,
  getCachedModelCapabilities,
  getOpenRouterCallsUsed,
  getOpenRouterModelCache,
  isAiDegradedError,
} from "../lib/ai/index.ts"
import { decryptSecret, encryptSecret } from "../lib/crypto.ts"
import { getDb } from "../lib/db.ts"
import { requireAuth } from "../middleware/auth.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()
route.use(requireAuth)

const EQUIPMENT_TAXONOMY = EquipmentSchema.options

function masterKey(env: AppEnv["Bindings"]): string | null {
  return (env as AppEnv["Bindings"] & { MASTER_KEY?: string }).MASTER_KEY ?? null
}

function configJson(row: {
  provider: string
  endpointOverride: string | null
  modelSlug: string | null
} | null) {
  if (!row) {
    return {
      configured: false as const,
      provider: null,
      endpointOverride: null,
      modelSlug: null,
    }
  }
  return {
    configured: true as const,
    provider: row.provider as AiProviderId,
    endpointOverride: row.endpointOverride,
    modelSlug: row.modelSlug ?? DEFAULT_OPENROUTER_MODEL,
  }
}

route.get("/config", async (c) => {
  const { tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const [row] = await db
    .select()
    .from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.tenantId, tenantId))
    .limit(1)

  return c.json(configJson(row ?? null))
})

route.get("/models", async (c) => {
  const cache = await getOpenRouterModelCache(c.env.SESSIONS_KV)
  if (!cache) {
    return c.json({ refreshedAt: null, models: [] })
  }
  // Prefer free + tool-capable for the settings picker.
  const models = cache.models
    .filter((m) => m.isFree && m.supportsTools)
    .slice(0, 80)
  return c.json({ refreshedAt: cache.refreshedAt, models })
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
  const modelSlug =
    body.data.modelSlug?.trim() ||
    (body.data.provider === "openrouter" ? DEFAULT_OPENROUTER_MODEL : "local-model")

  await db
    .insert(aiProviderConfigs)
    .values({
      tenantId,
      provider: body.data.provider,
      modelSlug,
      encryptedApiKey: ciphertext,
      iv,
      endpointOverride: endpoint,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: aiProviderConfigs.tenantId,
      set: {
        provider: body.data.provider,
        modelSlug,
        encryptedApiKey: ciphertext,
        iv,
        endpointOverride: endpoint,
        updatedAt: now,
      },
    })

  return c.json({
    configured: true,
    provider: body.data.provider,
    endpointOverride: endpoint,
    modelSlug,
  })
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
    if (!apiKey.trim()) return c.json({ ok: false, reason: "Empty key" }, 400)

    // Lightweight ping: OpenRouter models list (authed) or custom /models.
    if (row.provider === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      })
      if (res.status === 401) return c.json({ ok: false, reason: "Invalid API key" })
      if (!res.ok) return c.json({ ok: false, reason: `Provider returned ${res.status}` })
      return c.json({ ok: true })
    }

    const endpoint = row.endpointOverride?.trim()
    if (!endpoint) return c.json({ ok: false, reason: "Endpoint required for local provider" })
    const base = endpoint.replace(/\/$/, "")
    const modelsUrl = base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`
    const res = await fetch(modelsUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    })
    // Some local servers omit /models — treat decrypt + reachable host as ok on 404.
    if (res.status === 401) return c.json({ ok: false, reason: "Invalid API key" })
    if (res.ok || res.status === 404) return c.json({ ok: true })
    return c.json({ ok: false, reason: `Endpoint returned ${res.status}` })
  } catch (err) {
    return c.json({
      ok: false,
      reason: err instanceof Error ? err.message : "Could not verify provider",
    })
  }
})

async function loadProvider(c: {
  env: AppEnv["Bindings"]
  get: (k: "auth") => { tenantId: string }
}) {
  const key = masterKey(c.env)
  if (!key) throw Object.assign(new Error("MASTER_KEY missing"), { degradedReason: "MASTER_KEY missing" })

  const { tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const [row] = await db
    .select()
    .from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.tenantId, tenantId))
    .limit(1)

  if (!row) return null

  const apiKey = await decryptSecret(key, tenantId, row.encryptedApiKey, row.iv)
  const provider = createAIProvider(apiKey, row)
  return { provider, row, tenantId, apiKey }
}

route.post("/detect-equipment", async (c) => {
  const body = DetectEquipmentInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  let loaded: Awaited<ReturnType<typeof loadProvider>>
  try {
    loaded = await loadProvider(c)
  } catch (err) {
    return c.json({
      degraded: true,
      reason: err instanceof Error ? err.message : "AI unavailable",
      equipment: [] as Equipment[],
    })
  }

  if (!loaded) {
    return c.json({
      degraded: true,
      reason: "No AI provider configured — pick equipment manually",
      equipment: [] as Equipment[],
    })
  }

  if (loaded.row.provider === "openrouter") {
    const used = await getOpenRouterCallsUsed(c.env.SESSIONS_KV, loaded.tenantId)
    if (!canSpendOpenRouterQuota(used)) {
      return c.json({
        degraded: true,
        reason: "Daily OpenRouter quota reached — pick equipment manually",
        equipment: [] as Equipment[],
      })
    }

    const caps = await getCachedModelCapabilities(
      c.env.SESSIONS_KV,
      loaded.row.modelSlug ?? DEFAULT_OPENROUTER_MODEL,
    )
    // If we know the model lacks tools, skip the paid call and degrade immediately.
    if (caps && !caps.supportsTools) {
      return c.json({
        degraded: true,
        reason: "Selected model does not support tool calling — pick equipment manually",
        equipment: [] as Equipment[],
      })
    }
  }

  const image = body.data.imageBase64?.trim() ?? ""
  if (!image) {
    return c.json({
      degraded: true,
      reason: "No photo provided — pick equipment manually",
      equipment: [] as Equipment[],
    })
  }

  try {
    if (loaded.row.provider === "openrouter") {
      await addOpenRouterCall(c.env.SESSIONS_KV, loaded.tenantId)
    }
    const equipment = await loaded.provider.detectEquipment(image, [...EQUIPMENT_TAXONOMY])
    return c.json({ degraded: false, equipment })
  } catch (err) {
    const reason = isAiDegradedError(err)
      ? err.reason
      : err instanceof Error
        ? err.message
        : "Equipment detection failed"
    return c.json({ degraded: true, reason, equipment: [] as Equipment[] })
  }
})

route.post("/generate-routine", async (c) => {
  const body = GenerateRoutineInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  let loaded: Awaited<ReturnType<typeof loadProvider>>
  try {
    loaded = await loadProvider(c)
  } catch (err) {
    return c.json({
      degraded: true,
      reason: err instanceof Error ? err.message : "AI unavailable",
    })
  }

  if (!loaded) {
    return c.json({
      degraded: true,
      reason: "No AI provider configured — use the manual builder",
    })
  }

  const db = getDb(c.env.DB)
  const allExercises = await db.select().from(exercises)
  const available = allExercises.filter((ex) => {
    const eqTags = JSON.parse(ex.equipmentJson) as string[]
    return eqTags.some((t) => body.data.equipment.includes(t as Equipment))
  })

  if (available.length === 0) {
    return c.json({ degraded: true, reason: "No exercises match your equipment" })
  }

  const allowedExerciseIds = available.map((e) => e.id)
  const exerciseCatalog = available.map((e) => ({ id: e.id, name: e.name }))

  if (loaded.row.provider === "openrouter") {
    const used = await getOpenRouterCallsUsed(c.env.SESSIONS_KV, loaded.tenantId)
    if (!canSpendOpenRouterQuota(used)) {
      return c.json({
        degraded: true,
        reason: "Daily OpenRouter quota reached — use the manual builder",
      })
    }

    const caps = await getCachedModelCapabilities(
      c.env.SESSIONS_KV,
      loaded.row.modelSlug ?? DEFAULT_OPENROUTER_MODEL,
    )
    if (caps && !caps.supportsTools) {
      return c.json({
        degraded: true,
        reason: "Selected model does not support tool calling — use the manual builder",
      })
    }
  }

  try {
    if (loaded.row.provider === "openrouter") {
      await addOpenRouterCall(c.env.SESSIONS_KV, loaded.tenantId)
    }
    const result = await loaded.provider.generateRoutine({
      splitType: body.data.splitType,
      equipment: body.data.equipment,
      dayLabels: body.data.dayLabels,
      allowedExerciseIds,
      exerciseCatalog,
    })

    // Final unconditional guardrail against the equipment-filtered ID set.
    const known = new Set(allowedExerciseIds)
    const days = result.days.map((day) => ({
      label: day.label,
      exerciseIds: day.exerciseIds.filter((id) => known.has(id)),
    }))

    if (!days.some((d) => d.exerciseIds.length > 0)) {
      return c.json({
        degraded: true,
        reason: "AI returned no valid exercises — use the manual builder",
      })
    }

    return c.json({ degraded: false, days })
  } catch (err) {
    const reason = isAiDegradedError(err)
      ? err.reason
      : err instanceof Error
        ? err.message
        : "Routine generation failed"
    return c.json({ degraded: true, reason })
  }
})

export { route as aiRoutes }
