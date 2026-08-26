const QUOTA_CAP = 80 // self-imposed daily unit cap (architecture §4)

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
