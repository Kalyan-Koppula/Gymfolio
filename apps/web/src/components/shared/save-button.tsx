import { AlertCircle, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { WriteStatus } from "@/hooks/use-write-status"

export function SaveButton({
  status,
  onClick,
  idleLabel = "Save",
  className,
  size = "default",
}: {
  status: WriteStatus
  onClick: () => void
  idleLabel?: string
  className?: string
  size?: "default" | "sm"
}) {
  return (
    <Button
      onClick={onClick}
      disabled={status === "saving"}
      variant={status === "failed" ? "destructive" : "default"}
      className={cn(
        size === "default" ? "h-11 px-5 text-base" : "h-9",
        "min-w-28 transition-transform duration-150 active:scale-[0.97]",
        className,
      )}
    >
      {status === "saving" && (
        <>
          <Loader2 className="size-4 animate-spin" /> Saving…
        </>
      )}
      {status === "success" && (
        <span className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200 ease-out">
          <Check className="size-4" /> Saved
        </span>
      )}
      {status === "failed" && (
        <span className="flex items-center gap-1.5 animate-in fade-in duration-150">
          <AlertCircle className="size-4" /> Retry
        </span>
      )}
      {status === "idle" && idleLabel}
    </Button>
  )
}
