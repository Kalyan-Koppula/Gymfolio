import { ImageOff, PlayCircle } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Stands in for the real GIF/static-image asset. Rendered as a token-driven
 * placeholder rather than a broken-image icon so the fallback state is deliberate, not
 * an error look — real GIFs/stills swap in without changing this component's contract.
 */
export function ExerciseThumb({ hasGif, className }: { hasGif: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-muted to-muted/50",
        className,
      )}
    >
      {hasGif ? (
        <PlayCircle className="size-6 text-muted-foreground/60" aria-hidden="true" />
      ) : (
        <ImageOff className="size-6 text-muted-foreground/50" aria-hidden="true" />
      )}
      <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1 py-0.5 text-[9px] font-medium tracking-wide text-muted-foreground uppercase">
        {hasGif ? "GIF" : "Image"}
      </span>
    </div>
  )
}
