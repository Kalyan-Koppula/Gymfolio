import * as React from "react"
import { ChevronLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function TopBar({
  title,
  back,
  onBack,
  action,
  className,
}: {
  title: string
  back?: boolean
  /** Overrides default history back — e.g. minimize workout without finishing. */
  onBack?: () => void
  action?: React.ReactNode
  className?: string
}) {
  const navigate = useNavigate()
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className,
      )}
      style={{ paddingTop: "var(--safe-top)", height: "calc(3.5rem + var(--safe-top))" }}
    >
      {(back || onBack) && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={onBack ? "Minimize workout" : "Go back"}
          className="-ml-2 size-11"
          onClick={() => (onBack ? onBack() : navigate(-1))}
        >
          <ChevronLeft className="size-5" />
        </Button>
      )}
      <h1 className="font-heading flex-1 truncate text-lg font-semibold tracking-tight">{title}</h1>
      {action}
    </header>
  )
}
