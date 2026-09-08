import * as React from "react"
import { listExercises, fetchExerciseYoutube } from "@/lib/api-client"
import type { Exercise } from "shared"

let cache: Exercise[] | null = null
let inflight: Promise<Exercise[]> | null = null

/** Per-exercise YouTube lookup — at most one network attempt for the lifetime of this tab. */
const youtubeDone = new Set<string>()
const youtubeInflight = new Map<string, Promise<{ exercise: Exercise; skipped?: string }>>()

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

export function upsertExerciseInCache(updated: Exercise) {
  if (!cache) {
    cache = [updated]
    return
  }
  const i = cache.findIndex((e) => e.id === updated.id)
  if (i >= 0) cache = cache.map((e) => (e.id === updated.id ? updated : e))
  else cache = [...cache, updated]
}

/**
 * Lazy YouTube reference fetch (architecture §4). Idempotent: once attempted for an id
 * (success, skip, or failure), never hits the quota-limited endpoint again this session.
 * Ready exercises short-circuit without a network call.
 */
export async function ensureExerciseYoutube(
  id: string,
): Promise<{ exercise: Exercise; skipped?: string } | null> {
  const cached = cache?.find((e) => e.id === id)
  if (cached?.youtubeStatus === "ready") {
    youtubeDone.add(id)
    return { exercise: cached }
  }
  if (youtubeDone.has(id)) {
    const ex = cache?.find((e) => e.id === id)
    return ex ? { exercise: ex } : null
  }
  const existing = youtubeInflight.get(id)
  if (existing) return existing

  const promise = (async () => {
    try {
      const { exercise: updated, skipped } = await fetchExerciseYoutube(id)
      upsertExerciseInCache(updated)
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

  const applyExercise = React.useCallback((updated: Exercise) => {
    upsertExerciseInCache(updated)
    setExercises(cache)
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

  return { exercises, byId, loading: exercises === null && !error, error, refresh, applyExercise }
}

/** Imperative lookup for non-hook call sites (e.g. after await load). */
export async function fetchExercises(): Promise<Exercise[]> {
  return loadExercises()
}

export function exerciseByIdSync(id: string): Exercise | undefined {
  return cache?.find((e) => e.id === id)
}
