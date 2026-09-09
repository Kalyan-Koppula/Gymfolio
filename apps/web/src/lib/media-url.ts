/**
 * Exercise media URLs.
 *
 * Prefer a public CDN origin (no Worker byte-proxy):
 *   VITE_MEDIA_PUBLIC_ORIGIN=https://media.example.com
 *   → https://media.example.com/exercises/{slug}/thumb.<hash>.webp
 *
 * Else hit the Worker (optionally skipping Pages via VITE_MEDIA_ORIGIN):
 *   VITE_MEDIA_ORIGIN=https://api….workers.dev → {origin}/api/media/…
 *   (unset) → relative /api/media/… via Pages Function
 *
 * Object keys are content-addressed when seeded:
 *   exercises/{slug}/thumb.<hash>.webp
 */
const MEDIA_PUBLIC = (import.meta.env.VITE_MEDIA_PUBLIC_ORIGIN as string | undefined)?.replace(/\/$/, "") ?? ""
const MEDIA_ORIGIN = (import.meta.env.VITE_MEDIA_ORIGIN as string | undefined)?.replace(/\/$/, "") ?? ""

/** Build a public URL for a stored object key (`exercises/...`). */
export function mediaObjectUrl(objectKey: string | null | undefined): string | null {
  if (!objectKey) return null
  const key = objectKey.replace(/^\//, "")

  if (MEDIA_PUBLIC) {
    return `${MEDIA_PUBLIC}/${key.split("/").map(encodeURIComponent).join("/")}`
  }

  const path = key.startsWith("/") ? key : `/${key}`
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
