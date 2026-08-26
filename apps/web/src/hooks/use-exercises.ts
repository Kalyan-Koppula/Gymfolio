import * as React from "react"
import { listExercises } from "@/lib/api-client"
import type { Exercise } from "shared"

let cache: Exercise[] | null = null
let inflight: Promise<Exercise[]> | null = null

async function loadExercises(): Promise<Exercise[]> {
  if (cache) return cache
  if (!inflight) {
    inflight = listExercises()
      .then((res) => {
        cache = res.exercises
        return cache
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function invalidateExerciseCache() {
  cache = null
}

export function useExercises() {
  const [exercises, setExercises] = React.useState<Exercise[] | null>(cache)
  const [error, setError] = React.useState<string | null>(null)
  const [tick, setTick] = React.useState(0)

  const refresh = React.useCallback(async () => {
    invalidateExerciseCache()
    setTick((t) => t + 1)
    const list = await loadExercises()
    setExercises(list)
    return list
  }, [])

  React.useEffect(() => {
    let cancelled = false
    loadExercises()
      .then((list) => {
        if (!cancelled) setExercises(list)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load exercises")
      })
    return () => {
      cancelled = true
    }
  }, [tick])

  const byId = React.useCallback(
    (id: string) => exercises?.find((e) => e.id === id),
    [exercises],
  )

  return { exercises, byId, loading: exercises === null && !error, error, refresh }
}

/** Imperative lookup for non-hook call sites (e.g. after await load). */
export async function fetchExercises(): Promise<Exercise[]> {
  return loadExercises()
}

export function exerciseByIdSync(id: string): Exercise | undefined {
  return cache?.find((e) => e.id === id)
}
