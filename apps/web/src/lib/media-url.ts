/**
 * Exercise media URLs.
 *
 * Object keys are content-addressed when seeded:
 *   exercises/{slug}/thumb.<hash>.webp
 *
 * Set VITE_MEDIA_ORIGIN (no trailing slash) to the API Worker origin so thumbs
 * bypass the Pages /api proxy and hit Cloudflare’s edge-cached Worker directly.
 */
const MEDIA_ORIGIN = (import.meta.env.VITE_MEDIA_ORIGIN as string | undefined)?.replace(/\/$/, "") ?? ""

/** Build a public URL for a stored object key (`exercises/...`). */
export function mediaObjectUrl(objectKey: string | null | undefined): string | null {
  if (!objectKey) return null
  const path = objectKey.startsWith("/") ? objectKey : `/${objectKey}`
  const apiPath = path.startsWith("/api/media/") ? path : `/api/media${path}`
  return MEDIA_ORIGIN ? `${MEDIA_ORIGIN}${apiPath}` : apiPath
}

/**
 * Legacy stable paths (pre-hash). Prefer {@link mediaObjectUrl} with exercise.media keys.
 */
export function exerciseMediaUrl(
  exerciseId: string,
  file: "thumb.webp" | "thumb.gif" | "start.webp" | "end.webp" | "start.jpg" | "end.jpg",
) {
  return mediaObjectUrl(`exercises/${exerciseId}/${file}`) ?? `/api/media/exercises/${exerciseId}/${file}`
}
