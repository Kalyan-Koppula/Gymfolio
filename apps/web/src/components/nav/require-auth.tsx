import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useSession } from "@/contexts/session-context"

/** Layout route — renders its nested routes only with a valid session, otherwise bounces to
 * /login and remembers where the visitor was headed so login can send them back. */
export function RequireAuth() {
  const { user, loading } = useSession()
  const location = useLocation()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}
