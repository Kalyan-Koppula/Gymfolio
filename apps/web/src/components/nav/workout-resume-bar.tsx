import { useLocation, useNavigate } from "react-router-dom"
import { ChevronRight, Play } from "lucide-react"
import { TAB_BAR_CLEARANCE } from "@/components/nav/bottom-tab-bar"
import { useWorkoutSession } from "@/contexts/workout-session-context"

export const RESUME_BAR_HEIGHT = "3.25rem"

/**
 * Sits directly above the tab bar whenever a session is in progress and the user has
 * navigated away from it — a one-tap route back rather than making them re-enter through
 * Today.
 *
 * Wrapper is pointer-events:none so transparent inset-x space doesn't steal taps from
 * sticky action bars / FABs above; only the visible bar surface is interactive.
 */
export function WorkoutResumeBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { workout } = useWorkoutSession()

  if (!workout || location.pathname === "/train/workout") return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-0"
      style={{ bottom: TAB_BAR_CLEARANCE, height: RESUME_BAR_HEIGHT }}
      aria-hidden={false}
    >
      <button
        type="button"
        onClick={() => navigate("/train/workout")}
        className="pointer-events-auto flex h-full w-full max-w-2xl items-center gap-2.5 border-t border-primary/20 bg-primary/10 px-4 backdrop-blur animate-in slide-in-from-bottom-2 duration-200 ease-out supports-[backdrop-filter]:bg-primary/10"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Play className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
          {workout.dayLabel}
          <span className="text-muted-foreground">
            {" — "}
            {workout.setsCompleted}/{workout.setsPlanned} sets
          </span>
        </span>
        <span className="flex shrink-0 items-center text-xs font-medium text-primary">
          Resume <ChevronRight className="size-3.5" />
        </span>
      </button>
    </div>
  )
}
