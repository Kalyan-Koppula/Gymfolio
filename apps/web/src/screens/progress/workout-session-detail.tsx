import * as React from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { TopBar } from "@/components/nav/top-bar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { NumberStepper } from "@/components/shared/number-stepper"
import { EmptyState } from "@/components/shared/empty-state"
import { useExercises } from "@/hooks/use-exercises"
import { getWorkout, updateWorkoutSet } from "@/lib/api-client"
import type { WorkoutLog, WorkoutLogSet } from "shared"
import { Dumbbell } from "lucide-react"

export function WorkoutSessionDetail() {
  const { id } = useParams<{ id: string }>()
  const { byId } = useExercises()
  const [workout, setWorkout] = React.useState<WorkoutLog | null | undefined>(undefined)
  const [savingId, setSavingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!id) {
      setWorkout(null)
      return
    }
    getWorkout(id)
      .then((res) => setWorkout(res.workout))
      .catch(() => {
        toast.error("Couldn't load session")
        setWorkout(null)
      })
  }, [id])

  async function patchSet(set: WorkoutLogSet, patch: { actualReps?: number; actualWeightKg?: number }) {
    if (!workout) return
    setSavingId(set.id)
    try {
      const { set: updated } = await updateWorkoutSet(workout.id, set.id, patch)
      setWorkout((prev) => {
        if (!prev?.sets) return prev
        return {
          ...prev,
          sets: prev.sets.map((s) => (s.id === updated.id ? updated : s)),
        }
      })
    } catch {
      toast.error("Couldn't update set")
    } finally {
      setSavingId(null)
    }
  }

  if (workout === undefined) {
    return (
      <div>
        <TopBar title="Session" back />
        <div className="space-y-3 px-4 py-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!workout) {
    return (
      <div>
        <TopBar title="Session" back />
        <div className="px-4 py-4">
          <EmptyState icon={Dumbbell} title="Session not found" description="This workout may have been removed." />
        </div>
      </div>
    )
  }

  const sets = [...(workout.sets ?? [])].sort(
    (a, b) => a.exerciseId.localeCompare(b.exerciseId) || a.setIndex - b.setIndex,
  )

  const byExercise = new Map<string, WorkoutLogSet[]>()
  for (const s of sets) {
    const list = byExercise.get(s.exerciseId) ?? []
    list.push(s)
    byExercise.set(s.exerciseId, list)
  }

  return (
    <div>
      <TopBar title={workout.dayLabel} back />
      <div className="space-y-5 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{workout.date}</p>
            <p className="text-xs text-muted-foreground">
              {workout.setsCompleted}/{workout.setsPlanned} sets · {workout.completionPct}%
            </p>
          </div>
          <Badge variant={workout.status === "completed" ? "default" : "outline"}>{workout.status}</Badge>
        </div>

        {workout.status === "skipped" || sets.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title={workout.status === "skipped" ? "Skipped session" : "No sets logged"}
            description={
              workout.status === "skipped"
                ? "Skipped days have no sets to edit."
                : "This session has no logged sets."
            }
          />
        ) : (
          [...byExercise.entries()].map(([exerciseId, exerciseSets]) => (
            <div key={exerciseId} className="space-y-2">
              <h3 className="text-sm font-semibold">{byId(exerciseId)?.name ?? exerciseId}</h3>
              <div className="overflow-hidden rounded-xl border border-border divide-y divide-border">
                {exerciseSets.map((s) => (
                  <div
                    key={s.id}
                    className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                      savingId === s.id ? "opacity-70" : ""
                    }`}
                  >
                    <p className="text-xs font-medium text-muted-foreground">Set {s.setIndex + 1}</p>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Weight</p>
                        <NumberStepper
                          value={s.actualWeightKg}
                          step={2.5}
                          min={0}
                          suffix="kg"
                          size="compact"
                          onChange={(v) => patchSet(s, { actualWeightKg: v })}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Reps</p>
                        <NumberStepper
                          value={s.actualReps}
                          step={1}
                          min={0}
                          size="compact"
                          onChange={(v) => patchSet(s, { actualReps: v })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
