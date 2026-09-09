import { useLocation } from "react-router-dom"
import { BottomTabBar, TAB_BAR_CLEARANCE } from "@/components/nav/bottom-tab-bar"
import { PageTransition } from "@/components/nav/page-transition"
import { RESUME_BAR_HEIGHT, WorkoutResumeBar } from "@/components/nav/workout-resume-bar"
import { useWorkoutSession } from "@/hooks/use-workout-session"
import { APP_FRAME } from "@/lib/app-frame"
import { cn } from "@/lib/utils"

/** The active workout owns the whole viewport — tabs and the resume bar would only compete. */
const FULL_SCREEN_PATHS = ["/train/workout"]

export function AppShell() {
  const location = useLocation()
  const { workout } = useWorkoutSession()
  const fullScreen = FULL_SCREEN_PATHS.includes(location.pathname)

  if (fullScreen) {
    return (
      <div className="min-h-svh w-full bg-background md:bg-muted/25">
        <div className={cn("flex min-h-svh flex-col bg-background", APP_FRAME)}>
          <PageTransition />
        </div>
      </div>
    )
  }

  const showResumeBar = workout != null
  const clearance = showResumeBar ? `calc(${TAB_BAR_CLEARANCE} + ${RESUME_BAR_HEIGHT})` : TAB_BAR_CLEARANCE

  return (
    <div className="min-h-svh w-full bg-background md:bg-muted/25">
      <div className={cn("flex min-h-svh flex-col bg-background md:shadow-sm", APP_FRAME)}>
        <div className="flex-1" style={{ paddingBottom: clearance }}>
          <PageTransition />
        </div>
        <WorkoutResumeBar />
        <BottomTabBar />
      </div>
    </div>
  )
}
