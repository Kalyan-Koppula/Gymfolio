import * as React from "react"
import { useNavigate } from "react-router-dom"
import { ExternalLink } from "lucide-react"
import { ExerciseThumb } from "@/components/shared/exercise-thumb"
import { ExerciseMediaPlayer } from "@/components/shared/exercise-media-player"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { Exercise } from "shared"

/**
 * Larger tappable thumb that opens a lightbox reusing ExerciseMediaPlayer.
 * "View full exercise" is a separate action inside the modal — not the same tap target.
 */
export function ExerciseMediaQuickView({
  exercise,
  className,
}: {
  exercise: Pick<Exercise, "id" | "name" | "hasGif" | "media">
  className?: string
}) {
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Preview media for ${exercise.name}`}
        className={cn("block overflow-hidden rounded-lg ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      >
        <ExerciseThumb
          hasGif={exercise.hasGif}
          exerciseId={exercise.id}
          media={exercise.media}
          className="w-full"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md gap-4">
          <DialogHeader>
            <DialogTitle className="pr-6">{exercise.name}</DialogTitle>
            <DialogDescription>Quick peek — play/pause the start↔end reference.</DialogDescription>
          </DialogHeader>
          <ExerciseMediaPlayer
            exerciseId={exercise.id}
            hasGif={exercise.hasGif}
            media={exercise.media}
          />
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="h-11 w-full"
              variant="outline"
              onClick={() => {
                setOpen(false)
                navigate(`/train/exercise/${exercise.id}`)
              }}
            >
              <ExternalLink className="size-4" /> View full exercise
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
