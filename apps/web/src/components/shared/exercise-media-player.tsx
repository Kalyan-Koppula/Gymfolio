import { ChevronLeft, ChevronRight, ImageOff, Pause, Play } from "lucide-react"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MEDIA_ASPECT = "aspect-[850/567]"

const FRAME_MS = 900

type Frame = "start" | "end"

function mediaUrl(exerciseId: string, name: "start" | "end", webp: boolean) {
  const ext = webp ? "webp" : "jpg"
  return `/api/media/exercises/${exerciseId}/${name}.${ext}`
}

/**
 * Detail-page media: one hero with play/pause and start/end stepping.
 * Uses start/end stills (not the animated thumb) so pause actually works.
 */
export function ExerciseMediaPlayer({
  exerciseId,
  hasGif,
  className,
}: {
  exerciseId: string
  hasGif: boolean
  className?: string
}) {
  const [playing, setPlaying] = React.useState(hasGif)
  const [frame, setFrame] = React.useState<Frame>("start")
  const [endOk, setEndOk] = React.useState(hasGif)
  const [webp, setWebp] = React.useState(true)
  const [missing, setMissing] = React.useState(false)

  const canLoop = hasGif && endOk

  React.useEffect(() => {
    if (!canLoop || !playing) return
    const id = window.setInterval(() => {
      setFrame((f) => (f === "start" ? "end" : "start"))
    }, FRAME_MS)
    return () => window.clearInterval(id)
  }, [canLoop, playing])

  React.useEffect(() => {
    setPlaying(hasGif)
    setFrame("start")
    setEndOk(hasGif)
    setWebp(true)
    setMissing(false)
  }, [exerciseId, hasGif])

  const src = mediaUrl(exerciseId, frame, webp)

  function onImageError() {
    if (frame === "end" && webp) {
      setEndOk(false)
      setFrame("start")
      setPlaying(false)
      return
    }
    if (webp) setWebp(false)
    else setMissing(true)
  }

  function showEnd() {
    setPlaying(false)
    setFrame("end")
  }

  function showStart() {
    setPlaying(false)
    setFrame("start")
  }

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        className={cn("relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-muted", MEDIA_ASPECT)}
        onClick={() => canLoop && setPlaying((p) => !p)}
        aria-label={playing ? "Pause movement preview" : "Play movement preview"}
      >
        {!missing ? (
          <img
            key={`${src}-${frame}`}
            src={src}
            alt=""
            className="size-full object-cover"
            onError={onImageError}
          />
        ) : (
          <ImageOff className="size-8 text-muted-foreground/50" aria-hidden="true" />
        )}

        {canLoop ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {!playing ? (
              <span className="rounded-full bg-background/80 p-2.5 shadow-sm">
                <Play className="size-6 text-foreground" aria-hidden="true" />
              </span>
            ) : null}
          </span>
        ) : null}

        <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {canLoop ? (playing ? "Playing" : frame === "start" ? "Start" : "End") : "Photo"}
        </span>
      </button>

      {canLoop ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={playing ? "secondary" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {playing ? "Pause" : "Play"}
          </Button>

          {!playing ? (
            <>
              <Button
                type="button"
                variant={frame === "start" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={showStart}
              >
                <ChevronLeft className="size-4" />
                Start
              </Button>
              <Button
                type="button"
                variant={frame === "end" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={showEnd}
              >
                End
                <ChevronRight className="size-4" />
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Tap the image or Pause to inspect each position.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
