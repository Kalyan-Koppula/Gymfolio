import { ImageOff, PlayCircle } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"

/** Matches encoded media aspect (850×567 source photos). */
const MEDIA_ASPECT = "aspect-[850/567]"

/**
 * Shows the R2-backed GIF when available, else start still, else a calm placeholder.
 */
export function ExerciseThumb({
  hasGif,
  exerciseId,
  className,
}: {
  hasGif: boolean
  exerciseId?: string
  className?: string
}) {
  const [failed, setFailed] = React.useState(false)
  const [stillFailed, setStillFailed] = React.useState(false)
  const [stillJpgFailed, setStillJpgFailed] = React.useState(false)
  const gifSrc = hasGif && exerciseId && !failed ? `/api/media/exercises/${exerciseId}/thumb.webp` : null
  const stillWebp =
    exerciseId && (!hasGif || failed) && !stillFailed
      ? `/api/media/exercises/${exerciseId}/start.webp`
      : null
  const stillJpg =
    exerciseId && (!hasGif || failed) && stillFailed && !stillJpgFailed
      ? `/api/media/exercises/${exerciseId}/start.jpg`
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
