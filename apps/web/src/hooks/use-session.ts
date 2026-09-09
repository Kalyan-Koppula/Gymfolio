import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { User } from "shared"
import { getSession } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-client"

async function fetchSessionUser(): Promise<User | null> {
  try {
    const { user } = await getSession()
    return user
  } catch {
    return null
  }
}

/**
 * Session via TanStack Query — cookie is source of truth; `setUser` patches the cache
 * after login/register/logout without a full refetch.
 */
export function useSession() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.session,
    queryFn: fetchSessionUser,
    staleTime: 30_000,
  })

  const setUser = useCallback(
    (user: User | null) => {
      queryClient.setQueryData(queryKeys.session, user)
    },
    [queryClient],
  )

  const refetch = useCallback(async () => {
    await query.refetch()
  }, [query])

  return {
    user: query.data ?? null,
    loading: query.isLoading || query.isPending,
    refetch,
    setUser,
  }
}
