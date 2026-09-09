import * as React from "react"
import { Navigate } from "react-router-dom"
import { hasAccount } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"

/**
 * `/` decides where a fresh open belongs.
 * Valid session cookie → app (Netflix-style resume).
 * Otherwise → onboarding (first account) or login.
 */
export function RootRedirect() {
  const { user, loading } = useSession()
  const [target, setTarget] = React.useState<"/onboarding" | "/login" | null>(null)

  React.useEffect(() => {
    if (loading || user) return
    let cancelled = false
    hasAccount()
      .then(({ hasAccount }) => {
        if (!cancelled) setTarget(hasAccount ? "/login" : "/onboarding")
      })
      .catch(() => {
        if (!cancelled) setTarget("/login")
      })
    return () => {
      cancelled = true
    }
  }, [loading, user])

  if (loading) return null
  if (user) return <Navigate to="/today" replace />
  if (!target) return null
  return <Navigate to={target} replace />
}
