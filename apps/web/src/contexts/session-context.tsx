import * as React from "react"
import type { User } from "shared"
import { getSession } from "@/lib/api-client"

/**
 * Fetches the current session once on load, the way ai-provider-context fetches its stored
 * config — the difference is this one hits the API instead of localStorage, since the session
 * cookie itself is the source of truth. Backs both <RequireAuth> (no user -> redirect to
 * /login) and owner-only UI (Family & Access settings, invite management).
 */
type SessionState = {
  user: User | null
  loading: boolean
  refetch: () => Promise<void>
  setUser: (user: User | null) => void
}

const SessionContext = React.createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)

  const refetch = React.useCallback(async () => {
    try {
      const { user } = await getSession()
      setUser(user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refetch()
  }, [refetch])

  const value = React.useMemo(() => ({ user, loading, refetch, setUser }), [user, loading, refetch])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = React.useContext(SessionContext)
  if (!ctx) throw new Error("useSession must be used within SessionProvider")
  return ctx
}
