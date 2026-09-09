import { QueryClient } from "@tanstack/react-query"

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

export const queryKeys = {
  session: ["session"] as const,
  exercises: ["exercises"] as const,
  exercise: (id: string) => ["exercises", id] as const,
  aiConfig: ["ai-config"] as const,
  theme: ["theme"] as const,
  inProgressWorkout: ["workouts", "in-progress"] as const,
}
