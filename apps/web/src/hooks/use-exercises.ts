import { useQuery, useQueryClient } from "@tanstack/react-query"
import { listExercises, fetchExerciseYoutube } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-client"
import type { Exercise } from "shared"

/** Per-exercise YouTube lookup — at most one network attempt for the lifetime of this tab. */
const youtubeDone = new Set<string>()
const youtubeInflight = new Map<string, Promise<{ exercise: Exercise; skipped?: string }>>()

function readExerciseCache(queryClient: ReturnType<typeof useQueryClient>): Exercise[] | undefined {
  return queryClient.getQueryData<Exercise[]>(queryKeys.exercises)
}

export function invalidateExerciseCache(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.exercises })
}

export function upsertExerciseInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  updated: Exercise,
) {
  queryClient.setQueryData<Exercise[]>(queryKeys.exercises, (prev) => {
    if (!prev) return [updated]
    const i = prev.findIndex((e) => e.id === updated.id)
    if (i >= 0) return prev.map((e) => (e.id === updated.id ? updated : e))
    return [...prev, updated]
  })
}

/**
 * Lazy YouTube reference fetch (architecture §4). Idempotent: once attempted for an id
 * (success, skip, or failure), never hits the quota-limited endpoint again this session.
 * Ready exercises short-circuit without a network call.
 */
export async function ensureExerciseYoutube(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
): Promise<{ exercise: Exercise; skipped?: string } | null> {
  const cached = readExerciseCache(queryClient)?.find((e) => e.id === id)
  if (cached?.youtubeStatus === "ready") {
    youtubeDone.add(id)
    return { exercise: cached }
  }
  if (youtubeDone.has(id)) {
    const ex = readExerciseCache(queryClient)?.find((e) => e.id === id)
    return ex ? { exercise: ex } : null
  }
  const existing = youtubeInflight.get(id)
  if (existing) return existing

  const promise = (async () => {
    try {
      const { exercise: updated, skipped } = await fetchExerciseYoutube(id)
      upsertExerciseInCache(queryClient, updated)
      return { exercise: updated, skipped }
    } finally {
      youtubeDone.add(id)
      youtubeInflight.delete(id)
    }
  })()

  youtubeInflight.set(id, promise)
  return promise
}

export function useExercises() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.exercises,
    queryFn: async () => {
      const res = await listExercises()
      return res.exercises
    },
    staleTime: 5 * 60_000,
  })

  const exercises = query.data ?? null

  const refresh = async () => {
    const res = await query.refetch()
    return res.data ?? []
  }

  const applyExercise = (updated: Exercise) => {
    upsertExerciseInCache(queryClient, updated)
  }

  const byId = (id: string) => exercises?.find((e) => e.id === id)

  return {
    exercises,
    byId,
    loading: query.isLoading || (query.isPending && !query.data),
    error: query.error ? (query.error instanceof Error ? query.error.message : "Couldn't load exercises") : null,
    refresh,
    applyExercise,
  }
}

/** Imperative lookup for non-hook call sites (e.g. after await load). */
export async function fetchExercises(queryClient: ReturnType<typeof useQueryClient>): Promise<Exercise[]> {
  const existing = readExerciseCache(queryClient)
  if (existing) return existing
  return queryClient.fetchQuery({
    queryKey: queryKeys.exercises,
    queryFn: async () => {
      const res = await listExercises()
      return res.exercises
    },
  })
}

export function exerciseByIdSync(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
): Exercise | undefined {
  return readExerciseCache(queryClient)?.find((e) => e.id === id)
}
