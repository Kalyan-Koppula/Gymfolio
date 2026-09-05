import { useLocation } from "react-router-dom"
import { BottomTabBar, TAB_BAR_CLEARANCE } from "@/components/nav/bottom-tab-bar"
import { PageTransition } from "@/components/nav/page-transition"
import { RESUME_BAR_HEIGHT, WorkoutResumeBar } from "@/components/nav/workout-resume-bar"
import { WorkoutSessionProvider, useWorkoutSession } from "@/contexts/workout-session-context"

/** The active workout owns the whole viewport — tabs and the resume bar would only compete. */
const FULL_SCREEN_PATHS = ["/train/workout"]

export function AppShell() {
  return (
    <WorkoutSessionProvider>
      <AppShellLayout />
    </WorkoutSessionProvider>
  )
}

function AppShellLayout() {
  const location = useLocation()
  const { workout } = useWorkoutSession()
  const fullScreen = FULL_SCREEN_PATHS.includes(location.pathname)

  if (fullScreen) {
    return (
      <div className="mx-auto flex min-h-svh max-w-2xl flex-col bg-background">
        <PageTransition />
      </div>
    )
  }

  const showResumeBar = workout != null
  const clearance = showResumeBar ? `calc(${TAB_BAR_CLEARANCE} + ${RESUME_BAR_HEIGHT})` : TAB_BAR_CLEARANCE

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col bg-background">
      <div className="flex-1" style={{ paddingBottom: clearance }}>
        <PageTransition />
      </div>
      <WorkoutResumeBar />
      <BottomTabBar />
    </div>
  )
}
