import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * §1.6 — steppers, not raw text inputs, for repeated small numeric adjustments.
 * `size="touch"` meets the strict 44×44 minimum for the mid-set, sweaty-hands logging
 * screen (§3.10); `size="compact"` is a deliberate, calmer-context exception used only
 * in the seated routine-planning editor, where three steppers must share one row.
 */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
  size = "touch",
  className,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  suffix?: string
  size?: "touch" | "compact"
  className?: string
}) {
  const btn = size === "touch" ? "size-11" : "size-9"
  const icon = size === "touch" ? "size-4" : "size-3.5"
  const pressable =
    "flex shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-90 active:bg-muted"
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}
        className={cn(btn, pressable)}
      >
        <Minus className={icon} />
      </button>
      {/* key={value} replays the pop on every change — a quick, cheap confirmation that the
          tap registered, without a layout-shifting counter animation. */}
      <span
        key={value}
        className={cn(
          "animate-in zoom-in-75 duration-150 ease-out text-center font-semibold tabular-nums",
          size === "touch" ? "min-w-11 text-base" : "min-w-9 text-sm",
        )}
      >
        {value}
        {suffix && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{suffix}</span>}
      </span>
      <button
        type="button"
        aria-label="Increase"
        onClick={() => onChange(Math.round((value + step) * 100) / 100)}
        className={cn(btn, pressable)}
      >
        <Plus className={icon} />
      </button>
    </div>
  )
}
