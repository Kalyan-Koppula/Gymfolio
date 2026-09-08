import { ImageOff, PlayCircle } from "lucide-react"
import * as React from "react"
import { exerciseMediaUrl, mediaObjectUrl } from "@/lib/media-url"
import { cn } from "@/lib/utils"
import type { ExerciseMedia } from "shared"

/** Matches encoded media aspect (850×567 source photos). */
const MEDIA_ASPECT = "aspect-[850/567]"

/**
 * Shows the hashed thumb when available, else start still, else a calm placeholder.
 */
export function ExerciseThumb({
  hasGif,
  exerciseId,
  media,
  className,
}: {
  hasGif: boolean
  exerciseId?: string
  media?: ExerciseMedia
  className?: string
}) {
  const [failed, setFailed] = React.useState(false)
  const [stillFailed, setStillFailed] = React.useState(false)
  const [stillJpgFailed, setStillJpgFailed] = React.useState(false)

  React.useEffect(() => {
    setFailed(false)
    setStillFailed(false)
    setStillJpgFailed(false)
  }, [exerciseId, hasGif, media?.thumb, media?.start])

  const gifSrc =
    hasGif && !failed
      ? mediaObjectUrl(media?.thumb) ??
        (exerciseId ? exerciseMediaUrl(exerciseId, "thumb.webp") : null)
      : null
  const stillWebp =
    (!hasGif || failed) && !stillFailed
      ? mediaObjectUrl(media?.start) ??
        (exerciseId ? exerciseMediaUrl(exerciseId, "start.webp") : null)
      : null
  const stillJpg =
    (!hasGif || failed) && stillFailed && !stillJpgFailed && exerciseId
      ? exerciseMediaUrl(exerciseId, "start.jpg")
      : null
  const stillSrc = stillWebp ?? stillJpg
  const src = gifSrc ?? stillSrc

  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-muted",
        MEDIA_ASPECT,
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => {
            if (gifSrc && !failed) setFailed(true)
            else if (stillWebp && !stillFailed) setStillFailed(true)
            else setStillJpgFailed(true)
          }}
        />
      ) : null}
      <span className={cn("flex items-center justify-center", src && "hidden")}>
        {hasGif || stillSrc ? (
          <PlayCircle className="size-6 text-muted-foreground/60" aria-hidden="true" />
        ) : (
          <ImageOff className="size-6 text-muted-foreground/50" aria-hidden="true" />
        )}
      </span>
      <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1 py-0.5 text-[9px] font-medium tracking-wide text-muted-foreground uppercase">
        {gifSrc && !failed ? "Loop" : src ? "Photo" : "Image"}
      </span>
    </div>
  )
}
