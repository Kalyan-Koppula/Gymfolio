import * as React from "react"
import { getInProgressWorkout } from "@/lib/api-client"
import type { WorkoutLog } from "shared"

/**
 * Tracks the single in-progress workout so any screen can offer "resume" without each one
 * re-querying. Refreshed on mount, when the tab regains focus (another device may have
 * finished the session), and explicitly after start/finish/skip.
 */
type WorkoutSessionState = {
  workout: WorkoutLog | null
  loading: boolean
  refresh: () => Promise<WorkoutLog | null>
  clear: () => void
}

const WorkoutSessionContext = React.createContext<WorkoutSessionState | null>(null)

export function WorkoutSessionProvider({ children }: { children: React.ReactNode }) {
  const [workout, setWorkout] = React.useState<WorkoutLog | null>(null)
  const [loading, setLoading] = React.useState(true)
  const fetchGen = React.useRef(0)

  const refresh = React.useCallback(async () => {
    const gen = ++fetchGen.current
    try {
      const { workout: next } = await getInProgressWorkout()
      // Ignore stale responses so a late refresh can't resurrect a finished session.
      if (gen !== fetchGen.current) return next
      setWorkout(next)
      return next
    } catch {
      if (gen !== fetchGen.current) return null
      setWorkout(null)
      return null
    } finally {
      if (gen === fetchGen.current) setLoading(false)
    }
  }, [])

  const clear = React.useCallback(() => {
    fetchGen.current += 1
    setWorkout(null)
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  React.useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [refresh])

  const value = React.useMemo(() => ({ workout, loading, refresh, clear }), [workout, loading, refresh, clear])

  return <WorkoutSessionContext.Provider value={value}>{children}</WorkoutSessionContext.Provider>
}

export function useWorkoutSession() {
  const ctx = React.useContext(WorkoutSessionContext)
  if (!ctx) throw new Error("useWorkoutSession must be used within WorkoutSessionProvider")
  return ctx
}

/** Safe for StickyActionBar / shared chrome that may render outside the provider. */
export function useOptionalWorkoutSession() {
  return React.useContext(WorkoutSessionContext)
}
