import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * §1.6 — steppers, not raw text inputs, for repeated small numeric adjustments.
 * `size="touch"` meets the strict 44×44 minimum for the mid-set, sweaty-hands logging
 * screen (§3.10); `size="compact"` is a deliberate, calmer-context exception used only
 * in the seated routine-planning editor, where three steppers must share one row.
 *
 * `value: null` means unset (runtime weight with no prior performance) — shown as "—";
 * the first + tap seeds `max(min, step)`.
 */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
  size = "touch",
  className,
  emptyLabel = "—",
}: {
  value: number | null
  onChange: (v: number) => void
  step?: number
  min?: number
  suffix?: string
  size?: "touch" | "compact"
  className?: string
  emptyLabel?: string
}) {
  const btn = size === "touch" ? "size-11" : "size-9"
  const icon = size === "touch" ? "size-4" : "size-3.5"
  const pressable =
    "flex shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-90 active:bg-muted"
  const display = value == null ? emptyLabel : String(value)
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => {
          if (value == null) return
          onChange(Math.max(min, Math.round((value - step) * 100) / 100))
        }}
        className={cn(btn, pressable)}
      >
        <Minus className={icon} />
      </button>
      <span
        key={display}
        className={cn(
          "animate-in zoom-in-75 duration-150 ease-out text-center font-semibold tabular-nums",
          size === "touch" ? "min-w-11 text-base" : "min-w-9 text-sm",
          value == null && "text-muted-foreground",
        )}
      >
        {display}
        {value != null && suffix ? (
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">{suffix}</span>
        ) : null}
      </span>
      <button
        type="button"
        aria-label="Increase"
        onClick={() => {
          if (value == null) onChange(Math.max(min, step))
          else onChange(Math.round((value + step) * 100) / 100)
        }}
        className={cn(btn, pressable)}
      >
        <Plus className={icon} />
      </button>
    </div>
  )
}
