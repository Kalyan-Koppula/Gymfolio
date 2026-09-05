import type { Bindings } from "../types.ts"
import { refreshOpenRouterModelCache } from "./ai/model-cache.ts"
import { revalidateYoutubeRefs } from "./youtube.ts"

/**
 * Daily Cron jobs (architecture §4 / §7):
 * 1. YouTube link revalidation (videos.list) when YOUTUBE_API_KEY is set
 * 2. OpenRouter model-capability cache refresh
 */
export async function runScheduledJobs(env: Bindings): Promise<void> {
  const results: string[] = []

  try {
    await refreshOpenRouterModelCache(env.SESSIONS_KV)
    results.push("openrouter_models:ok")
  } catch (err) {
    console.error("[cron] openrouter model cache failed", err)
    results.push("openrouter_models:fail")
  }

  const ytKey = env.YOUTUBE_API_KEY
  if (ytKey) {
    try {
      const r = await revalidateYoutubeRefs(env.DB, env.SESSIONS_KV, ytKey)
      results.push(`youtube:checked=${r.checked},cleared=${r.cleared}`)
    } catch (err) {
      console.error("[cron] youtube revalidation failed", err)
      results.push("youtube:fail")
    }
  } else {
    results.push("youtube:skipped")
  }

  console.log("[cron]", results.join(" | "))
}
