import * as React from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Check, ChevronRight, History, ListChecks, Moon, X } from "lucide-react"
import { TopBar } from "@/components/nav/top-bar"
import { OfflineBanner } from "@/components/shared/offline-banner"
import { ExerciseMediaQuickView } from "@/components/shared/exercise-media-quick-view"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { NumberStepper } from "@/components/shared/number-stepper"
import { StickyActionBar } from "@/components/shared/sticky-action-bar"
import { Button } from "@/components/ui/button"
import { useApiWrite } from "@/hooks/use-api-write"
import { useExercises } from "@/hooks/use-exercises"
import {
  finishWorkout,
  getCycleStep,
  getLastPerformances,
  getRoutine,
  logWorkoutSet,
  startWorkout,
} from "@/lib/api-client"
import { useWorkoutSession } from "@/contexts/workout-session-context"
import { activeDays, suggestNextWeight, type RoutineDay } from "@/lib/stub-data"
import type { LastPerformance, Routine } from "shared"

type SetLog = { reps: number; weightKg: number; completed: boolean }

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function ActiveWorkout() {
  const navigate = useNavigate()
  const { byId, loading: exercisesLoading } = useExercises()
  const [routine, setRoutine] = React.useState<Routine | null | undefined>(undefined)
  const [cycleStep, setCycleStep] = React.useState(0)
  const [performances, setPerformances] = React.useState<LastPerformance[]>([])

  React.useEffect(() => {
    getRoutine()
      .then(async (res) => {
        const r = res.routine
        setRoutine(r)
        const slots = r ? activeDays(r.days).length : 0
        if (slots > 0) {
          const step = await getCycleStep(slots)
          setCycleStep(step.cycleStep)
        }
      })
      .catch(() => {
        setRoutine(null)
        toast.error("Couldn't load your routine")
      })
    getLastPerformances()
      .then((res) => setPerformances(res.performances))
      .catch(() => {})
  }, [])

  if (routine === undefined || exercisesLoading) {
    return (
      <div className="space-y-4 px-4 py-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const slots = routine ? activeDays(routine.days) : []

  if (routine === null || slots.length === 0) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={ListChecks}
          title="No routine to work from yet"
          description="Build a routine first — then today's workout picks itself from wherever you are in the split."
          actionLabel="Go to Routine Builder"
          onAction={() => navigate("/train/routine/new")}
        />
      </div>
    )
  }

  const day = slots[cycleStep % slots.length]

  if (day.dayType === "rest") {
    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={Moon}
          title={`${day.label} — nothing to log`}
          description="Today's slot is a rest day. Mark it done from Today to advance the cycle."
          actionLabel="Back to Today"
          onAction={() => navigate("/today")}
        />
      </div>
    )
  }

  if (day.exercises.length === 0) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={ListChecks}
          title={`${day.label} has no exercises`}
          description="Add exercises to this day in the routine builder, then start the session."
          actionLabel="Go to Routine Builder"
          onAction={() => navigate("/train/routine/new")}
        />
      </div>
    )
  }

  const dayWithPerf: RoutineDay = {
    ...day,
    exercises: day.exercises.map((re) => {
      const perf = performances.find((p) => p.exerciseId === re.exerciseId)
      return perf
        ? { ...re, lastPerformance: { reps: perf.reps, weightKg: perf.weightKg, date: perf.date } }
        : re
    }),
  }

  return (
    <ActiveWorkoutSession
      key={day.id}
      day={dayWithPerf}
      dayIndex={cycleStep % slots.length}
      byId={byId}
    />
  )
}

function ActiveWorkoutSession({
  day,
  dayIndex,
  byId,
}: {
  day: RoutineDay
  dayIndex: number
  byId: (id: string) => import("shared").Exercise | undefined
}) {
  const navigate = useNavigate()
  const { refresh: refreshSession, clear: clearSession } = useWorkoutSession()
  const [exIndex, setExIndex] = React.useState(0)
  const [workoutId, setWorkoutId] = React.useState<string | null>(null)
  const target = day.exercises[exIndex]
  const exercise = byId(target.exerciseId)
  const totalSets = target.targetSets

  const [setsByExercise, setSetsByExercise] = React.useState<Record<string, SetLog[]>>(() =>
    Object.fromEntries(
      day.exercises.map((re) => [
        re.exerciseId,
        Array.from({ length: re.targetSets }, () => ({
          reps: re.lastPerformance?.reps ?? (parseInt(re.targetReps) || 10),
          weightKg: suggestNextWeight(re) ?? 20,
        })).map((s) => ({ ...s, completed: false })),
      ]),
    ),
  )
  const sets = setsByExercise[target.exerciseId]
  const currentSetIndex = sets.findIndex((s) => !s.completed)
  const activeSetIndex = currentSetIndex === -1 ? sets.length - 1 : currentSetIndex
  const completedCount = sets.filter((s) => s.completed).length

  const { status, run } = useApiWrite("Set logged")
  const { status: finishStatus, run: runFinish } = useApiWrite("Workout saved")

  const totalPlannedSets = day.exercises.reduce((n, e) => n + e.targetSets, 0)

  React.useEffect(() => {
    let cancelled = false
    startWorkout({
      date: todayIso(),
      dayLabel: day.label,
      dayIndex,
      setsPlanned: totalPlannedSets,
    })
      .then((res) => {
        if (cancelled) return
        setWorkoutId(res.workout.id)
        void refreshSession()
        // Restore already-logged sets if resuming.
        if (res.workout.sets && res.workout.sets.length > 0) {
          setSetsByExercise((prev) => {
            const next = { ...prev }
            for (const logged of res.workout.sets!) {
              const arr = next[logged.exerciseId]
              if (!arr || !arr[logged.setIndex]) continue
              arr[logged.setIndex] = {
                reps: logged.actualReps,
                weightKg: logged.actualWeightKg,
                completed: true,
              }
            }
            return { ...next }
          })
        }
      })
      .catch(() => toast.error("Couldn't start workout session"))
    return () => {
      cancelled = true
    }
  }, [day.label, dayIndex, totalPlannedSets, refreshSession])

  function updateSet(idx: number, patch: Partial<SetLog>) {
    setSetsByExercise((prev) => ({
      ...prev,
      [target.exerciseId]: prev[target.exerciseId].map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }))
  }

  function logSet() {
    if (!workoutId) {
      toast.error("Workout session isn't ready yet")
      return
    }
    const active = sets[activeSetIndex]
    run(
      () =>
        logWorkoutSet(workoutId, {
          exerciseId: target.exerciseId,
          setIndex: activeSetIndex,
          actualReps: active.reps,
          actualWeightKg: active.weightKg,
        }),
      () => updateSet(activeSetIndex, { completed: true }),
    )
  }

  function finish() {
    if (!workoutId) {
      navigate("/today")
      return
    }
    runFinish(
      () => finishWorkout(workoutId),
      () => {
        // Drop the resume bar immediately, then reconcile against the server.
        clearSession()
        void refreshSession()
        navigate("/today")
      },
    )
  }

  const totalCompletedSets = day.exercises.reduce(
    (n, e) => n + (setsByExercise[e.exerciseId]?.filter((s) => s.completed).length ?? 0),
    0,
  )

  const isLastExercise = exIndex === day.exercises.length - 1

  if (!exercise) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={ListChecks}
          title="Exercise not found"
          description="This routine references an exercise that isn't in the library."
          actionLabel="Back to Today"
          onAction={() => navigate("/today")}
        />
      </div>
    )
  }

  return (
    <div>
      <TopBar
        title={exercise.name}
        onBack={() => {
          // Session stays live — resume mini-bar picks it up on other screens.
          void refreshSession()
          navigate("/today")
        }}
        action={
          <Badge variant="secondary">
            Ex {exIndex + 1}/{day.exercises.length}
          </Badge>
        }
      />
      <OfflineBanner />

      <div className="space-y-5 px-4 py-4 pb-40">
        <div className="flex items-center justify-between">
          <Badge>{day.label}</Badge>
          <span className="text-sm font-medium text-muted-foreground">
            {totalCompletedSets}/{totalPlannedSets} sets today
          </span>
        </div>

        <div className="flex gap-3">
          <ExerciseMediaQuickView exercise={exercise} className="w-24 shrink-0" />
          <div className="flex-1 space-y-1">
            <p className="text-sm text-muted-foreground">
              Target: {target.targetSets} × {target.targetReps}
              {target.targetWeightKg ? ` @ ${target.targetWeightKg}kg` : ""}
            </p>
            <div className="flex flex-wrap gap-1">
              {sets.map((s, i) => (
                <span
                  key={i}
                  className="flex size-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors duration-300"
                  style={{
                    backgroundColor: s.completed ? "var(--success)" : "var(--muted)",
                    color: s.completed ? "var(--success-foreground)" : "var(--muted-foreground)",
                  }}
                >
                  {s.completed ? (
                    <Check key={`done-${i}`} className="size-3.5 animate-in zoom-in-50 duration-200 ease-out" />
                  ) : (
                    i + 1
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        <Card className="border-primary/30">
          <CardContent className="space-y-4">
            {target.lastPerformance && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <History className="size-3.5" />
                Last time: {target.lastPerformance.reps} reps @ {target.lastPerformance.weightKg}kg
                {suggestNextWeight(target) !== target.lastPerformance.weightKg && (
                  <span className="font-medium text-success">
                    → suggested {suggestNextWeight(target)}kg today
                  </span>
                )}
              </div>
            )}
            <p className="text-center text-sm font-medium text-muted-foreground">
              Set {activeSetIndex + 1} of {totalSets}
            </p>
            <div className="flex items-center justify-center gap-8">
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Reps</span>
                <NumberStepper
                  value={sets[activeSetIndex].reps}
                  onChange={(v) => updateSet(activeSetIndex, { reps: v })}
                  min={0}
                  size="touch"
                />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Weight</span>
                <NumberStepper
                  value={sets[activeSetIndex].weightKg}
                  onChange={(v) => updateSet(activeSetIndex, { weightKg: v })}
                  step={2.5}
                  min={0}
                  suffix="kg"
                  size="touch"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {completedCount > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Logged sets</p>
            <div className="space-y-1.5">
              {sets.map((s, i) =>
                s.completed ? (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm animate-in fade-in slide-in-from-top-1 duration-200 ease-out"
                  >
                    <span className="flex items-center gap-2">
                      <Check className="size-3.5 text-success" /> Set {i + 1}
                    </span>
                    <span className="font-medium">
                      {s.reps} reps @ {s.weightKg}kg
                    </span>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        )}
      </div>

      <StickyActionBar>
        <div key={completedCount === totalSets ? "advance" : "log"} className="flex gap-2 animate-in fade-in zoom-in-95 duration-200 ease-out">
          {completedCount === totalSets ? (
            isLastExercise ? (
              <Button
                className="h-12 w-full text-base"
                onClick={finish}
                disabled={finishStatus === "saving"}
              >
                <Check className="size-4" />{" "}
                {finishStatus === "saving" ? "Saving…" : "Finish workout"}
              </Button>
            ) : (
              <Button className="h-12 w-full text-base" onClick={() => setExIndex((i) => i + 1)}>
                Next exercise <ChevronRight className="size-4" />
              </Button>
            )
          ) : (
            <>
              <Button
                variant="destructive"
                size="icon"
                aria-label="Leave workout"
                className="size-12 shrink-0"
                onClick={() => {
                  // The session stays open server-side — the resume bar brings them back.
                  void refreshSession()
                  navigate("/today")
                }}
              >
                <X className="size-5" />
              </Button>
              <Button
                onClick={logSet}
                disabled={status === "saving" || !workoutId}
                variant={status === "failed" ? "destructive" : "default"}
                className="h-12 flex-1 text-base"
              >
                {status === "saving" ? "Saving…" : status === "failed" ? "Retry — couldn't save" : "Log set"}
              </Button>
            </>
          )}
        </div>
      </StickyActionBar>
    </div>
  )
}
