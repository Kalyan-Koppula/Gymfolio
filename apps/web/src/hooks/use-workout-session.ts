import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getInProgressWorkout } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-client"
import { useSession } from "@/hooks/use-session"
import type { WorkoutLog } from "shared"

/**
 * Single in-progress workout — Query cache shared across screens.
 * Refetches on window focus; call `refresh` after start/finish/skip.
 */
export function useWorkoutSession() {
  const { user } = useSession()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.inProgressWorkout,
    queryFn: async () => {
      const { workout } = await getInProgressWorkout()
      return workout
    },
    enabled: Boolean(user),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })

  const refresh = useCallback(async (): Promise<WorkoutLog | null> => {
    const res = await queryClient.fetchQuery({
      queryKey: queryKeys.inProgressWorkout,
      queryFn: async () => {
        const { workout } = await getInProgressWorkout()
        return workout
      },
    })
    return res
  }, [queryClient])

  const clear = useCallback(() => {
    queryClient.setQueryData(queryKeys.inProgressWorkout, null)
  }, [queryClient])

  return {
    workout: query.data ?? null,
    loading: Boolean(user) && (query.isLoading || query.isPending),
    refresh,
    clear,
  }
}

/** Alias — Query is always available under AppProviders. */
export const useOptionalWorkoutSession = useWorkoutSession
