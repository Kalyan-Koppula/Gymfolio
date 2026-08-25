import * as React from "react"
import { Navigate } from "react-router-dom"
import { hasAccount } from "@/lib/api-client"

/** The `/` route has no screen of its own — it just decides where a fresh visitor belongs.
 * No account anywhere yet means this is the very first run (owner bootstrap); an account
 * already existing means every other visitor goes to the password/passkey login screen,
 * never straight into onboarding. */
export function RootRedirect() {
  const [target, setTarget] = React.useState<"/onboarding" | "/login" | null>(null)

  React.useEffect(() => {
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
  }, [])

  if (!target) return null
  return <Navigate to={target} replace />
}
