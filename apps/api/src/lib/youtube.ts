const QUOTA_CAP = 9_500 // keep headroom under YouTube's ~10k units/day default


export async function getYoutubeUnitsUsed(kv: KVNamespace): Promise<number> {
  const day = new Date().toISOString().slice(0, 10)
  const raw = await kv.get(`youtube_quota:${day}`)
  return raw ? Number(raw) : 0
}

export async function addYoutubeUnits(kv: KVNamespace, units: number): Promise<number> {
  const day = new Date().toISOString().slice(0, 10)
  const key = `youtube_quota:${day}`
  const current = await getYoutubeUnitsUsed(kv)
  const next = current + units
  await kv.put(key, String(next), { expirationTtl: 60 * 60 * 48 })
  return next
}

export function canSpendYoutubeQuota(used: number, cost: number): boolean {
  return used + cost <= QUOTA_CAP
}

export function formatViewCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M views`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K views`
  return `${n} views`
}

export type YoutubeRef = {
  videoId: string
  title: string
  channel: string
  views: string
}

/**
 * Daily Cron: revalidate stored video IDs via videos.list (1 unit per ≤50 IDs).
 * Marks deleted/privated refs as not_fetched so the next detail view can re-search.
 */
export async function revalidateYoutubeRefs(
  db: D1Database,
  kv: KVNamespace,
  apiKey: string,
): Promise<{ checked: number; cleared: number }> {
  const rows = await db
    .prepare(
      `SELECT id, youtube_json FROM exercises WHERE youtube_status = 'ready' AND youtube_json IS NOT NULL`,
    )
    .all<{ id: string; youtube_json: string }>()

  const entries: Array<{ id: string; videoId: string }> = []
  for (const row of rows.results ?? []) {
    try {
      const parsed = JSON.parse(row.youtube_json) as { videoId?: string }
      if (parsed.videoId) entries.push({ id: row.id, videoId: parsed.videoId })
    } catch {
      // skip malformed
    }
  }

  let checked = 0
  let cleared = 0
  const batchSize = 50

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize)
    const cost = 1
    const used = await getYoutubeUnitsUsed(kv)
    if (!canSpendYoutubeQuota(used, cost)) break

    const ids = batch.map((b) => b.videoId).join(",")
    const url = `https://www.googleapis.com/youtube/v3/videos?part=status,id&id=${ids}&key=${apiKey}`
    const res = await fetch(url)
    await addYoutubeUnits(kv, cost)
    checked += batch.length
    if (!res.ok) continue

    const data = (await res.json()) as { items?: Array<{ id?: string; status?: { privacyStatus?: string } }> }
    const live = new Set(
      (data.items ?? [])
        .filter((it) => it.id && it.status?.privacyStatus !== "private")
        .map((it) => it.id!),
    )

    for (const entry of batch) {
      if (live.has(entry.videoId)) continue
      await db
        .prepare(
          `UPDATE exercises SET youtube_status = 'not_fetched', youtube_json = NULL WHERE id = ?`,
        )
        .bind(entry.id)
        .run()
      cleared += 1
    }
  }

  return { checked, cleared }
}

export async function searchExerciseVideo(
  apiKey: string,
  exerciseName: string,
): Promise<YoutubeRef | null> {
  const q = encodeURIComponent(`${exerciseName} form tutorial`)
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&order=relevance&q=${q}&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as {
    items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }>
  }
  const item = data.items?.[0]
  const videoId = item?.id?.videoId
  if (!videoId) return null

  const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}&key=${apiKey}`
  const statsRes = await fetch(statsUrl)
  if (!statsRes.ok) {
    return {
      videoId,
      title: item.snippet?.title ?? exerciseName,
      channel: item.snippet?.channelTitle ?? "YouTube",
      views: "",
    }
  }
  const stats = (await statsRes.json()) as {
    items?: Array<{ snippet?: { title?: string; channelTitle?: string }; statistics?: { viewCount?: string } }>
  }
  const full = stats.items?.[0]
  const viewCount = Number(full?.statistics?.viewCount ?? 0)
  return {
    videoId,
    title: full?.snippet?.title ?? item.snippet?.title ?? exerciseName,
    channel: full?.snippet?.channelTitle ?? item.snippet?.channelTitle ?? "YouTube",
    views: viewCount > 0 ? formatViewCount(viewCount) : "",
  }
}
