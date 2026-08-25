import * as React from "react"
import { Button } from "@/components/ui/button"

/** §3.15 — generic empty state, always paired with a CTA into the action that fills it. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center animate-in fade-in duration-300 ease-out">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted animate-in zoom-in-75 duration-300 ease-out">
        <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="font-heading text-base font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-1 h-11 px-5 text-base">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
