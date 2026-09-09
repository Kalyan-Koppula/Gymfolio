import * as React from "react"
import { createPortal } from "react-dom"
import { useLocation } from "react-router-dom"
import { TAB_BAR_CLEARANCE } from "@/components/nav/bottom-tab-bar"
import { RESUME_BAR_HEIGHT } from "@/components/nav/workout-resume-bar"
import { useOptionalWorkoutSession } from "@/hooks/use-workout-session"
import { APP_FRAME } from "@/lib/app-frame"
import { cn } from "@/lib/utils"

const FULL_SCREEN_PATHS = ["/train/workout"]

/**
 * §1.6 — primary actions belong in the thumb-zone bottom third.
 * Clears the tab bar, and the resume mini-bar when a live session is parked elsewhere.
 */
export function StickyActionBar({ children, className }: { children: React.ReactNode; className?: string }) {
  const location = useLocation()
  const session = useOptionalWorkoutSession()
  const fullScreen = FULL_SCREEN_PATHS.includes(location.pathname)
  const showResumeBar = Boolean(session.workout) && !fullScreen

  const bottom = fullScreen
    ? "var(--safe-bottom)"
    : showResumeBar
      ? `calc(${TAB_BAR_CLEARANCE} + ${RESUME_BAR_HEIGHT})`
      : TAB_BAR_CLEARANCE

  return createPortal(
    <div
      className={cn(
        "fixed inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85",
        className,
      )}
      style={{ bottom }}
    >
      <div className={cn("px-4 py-3", APP_FRAME)}>{children}</div>
    </div>,
    document.body,
  )
}
