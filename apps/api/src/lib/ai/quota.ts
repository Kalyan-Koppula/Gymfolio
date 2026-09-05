/** Self-imposed daily call cap (architecture §7 — under OpenRouter's 50/day free floor). */
export const OPENROUTER_DAILY_CAP = 40

function dayKey(tenantId: string): string {
  const day = new Date().toISOString().slice(0, 10)
  return `openrouter_quota:${tenantId}:${day}`
}

export async function getOpenRouterCallsUsed(kv: KVNamespace, tenantId: string): Promise<number> {
  const raw = await kv.get(dayKey(tenantId))
  return raw ? Number(raw) : 0
}

export async function addOpenRouterCall(kv: KVNamespace, tenantId: string): Promise<number> {
  const key = dayKey(tenantId)
  const current = await getOpenRouterCallsUsed(kv, tenantId)
  const next = current + 1
  await kv.put(key, String(next), { expirationTtl: 60 * 60 * 48 })
  return next
}

export function canSpendOpenRouterQuota(used: number, cost = 1): boolean {
  return used + cost <= OPENROUTER_DAILY_CAP
}
