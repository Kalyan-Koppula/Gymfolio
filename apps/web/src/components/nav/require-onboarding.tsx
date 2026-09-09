import * as React from "react"
import { Navigate, Outlet } from "react-router-dom"
import { hasAccount } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"

/**
 * /onboarding is for (1) bootstrapping the first owner when no account exists yet, or
 * (2) a signed-in member finishing personalization after /join.
 * Direct visits when an admin already exists and the visitor has no session → /login.
 */
export function RequireOnboarding() {
  const { user, loading: sessionLoading } = useSession()
  const [allowed, setAllowed] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    if (sessionLoading) return
    if (user) {
      setAllowed(true)
      return
    }

    let cancelled = false
    hasAccount()
      .then(({ hasAccount: exists }) => {
        if (!cancelled) setAllowed(!exists)
      })
      .catch(() => {
        // Fail closed — don't expose bootstrap UI if we can't tell.
        if (!cancelled) setAllowed(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionLoading, user])

  if (sessionLoading || allowed === null) return null
  if (!allowed) return <Navigate to="/login" replace />
  return <Outlet />
}
