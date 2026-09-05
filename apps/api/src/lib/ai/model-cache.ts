export const OPENROUTER_MODELS_KV_KEY = "openrouter_models_cache"

export type CachedOpenRouterModel = {
  id: string
  name?: string
  isFree: boolean
  supportsVision: boolean
  supportsTools: boolean
}

export type OpenRouterModelsCache = {
  refreshedAt: number
  models: CachedOpenRouterModel[]
}

type OpenRouterModelsApiResponse = {
  data?: Array<{
    id?: string
    name?: string
    pricing?: { prompt?: string; completion?: string }
    architecture?: { modality?: string; input_modalities?: string[] }
    supported_parameters?: string[]
  }>
}

function isFreePricing(prompt?: string, completion?: string): boolean {
  const p = Number(prompt ?? "1")
  const c = Number(completion ?? "1")
  return (Number.isFinite(p) && p === 0 && Number.isFinite(c) && c === 0) || false
}

/**
 * Refresh the OpenRouter model-capability snapshot into KV (architecture §7).
 * Called from the Worker Cron Trigger — no API key required for /models.
 */
export async function refreshOpenRouterModelCache(kv: KVNamespace): Promise<OpenRouterModelsCache> {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Accept: "application/json" },
  })
  if (!res.ok) {
    throw new Error(`OpenRouter /models failed: ${res.status}`)
  }

  const body = (await res.json()) as OpenRouterModelsApiResponse
  const models: CachedOpenRouterModel[] = []

  for (const m of body.data ?? []) {
    if (!m.id) continue
    const modalities = m.architecture?.input_modalities ?? []
    const modality = m.architecture?.modality ?? ""
    const supportsVision =
      modalities.includes("image") || modality.includes("image") || modality.includes("vision")
    const params = m.supported_parameters ?? []
    const supportsTools = params.includes("tools") || params.includes("tool_choice")
    const freeByPrice = isFreePricing(m.pricing?.prompt, m.pricing?.completion)
    const freeBySlug = m.id.includes(":free") || m.id === "openrouter/free"
    models.push({
      id: m.id,
      name: m.name,
      isFree: freeByPrice || freeBySlug,
      supportsVision,
      supportsTools,
    })
  }

  const cache: OpenRouterModelsCache = { refreshedAt: Date.now(), models }
  await kv.put(OPENROUTER_MODELS_KV_KEY, JSON.stringify(cache), {
    expirationTtl: 60 * 60 * 48,
  })
  return cache
}

export async function getOpenRouterModelCache(kv: KVNamespace): Promise<OpenRouterModelsCache | null> {
  const raw = await kv.get(OPENROUTER_MODELS_KV_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as OpenRouterModelsCache
  } catch {
    return null
  }
}

export async function getCachedModelCapabilities(
  kv: KVNamespace,
  modelSlug: string,
): Promise<CachedOpenRouterModel | null> {
  const cache = await getOpenRouterModelCache(kv)
  if (!cache) return null
  return cache.models.find((m) => m.id === modelSlug) ?? null
}
