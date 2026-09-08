import * as React from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Check, Moon, Pencil, Plus, Trash2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { NumberStepper } from "@/components/shared/number-stepper"
import { ExerciseMediaQuickView } from "@/components/shared/exercise-media-quick-view"
import { AddExerciseSheet } from "@/components/shared/add-exercise-sheet"
import {
  activeDays,
  normalizeRoutineDay,
  type Equipment,
  type Exercise,
  type RoutineDay,
} from "@/lib/stub-data"
import { useExercises } from "@/hooks/use-exercises"

/** How long the "Undo" on a removed day stays offered before the archive is effectively final. */
const UNDO_WINDOW_MS = 8000

function isLikelyBodyweightExercise(ex?: Exercise) {
  if (!ex) return false
  const eq = ex.equipment
  if (eq.length === 0) return true
  const loadBearing = eq.some((e) =>
    ["barbell", "dumbbell", "kettlebell", "cable-machine", "squat-rack", "bench"].includes(e),
  )
  return !loadBearing
}

function parseLeadingInt(s: string, fallback: number) {
  const m = s.match(/\d+/)
  return m ? Number(m[0]) : fallback
}

/** Renumbers active days 0..n-1; archived days keep their old index so Undo restores in place. */
function reindexActive(all: RoutineDay[]): RoutineDay[] {
  const archived = all.filter((d) => d.archivedAt != null)
  const active = activeDays(all).map((d, i) => normalizeRoutineDay({ ...d, orderIndex: i }, i))
  return [...active, ...archived]
}

/**
 * Day-tabs + per-exercise editor, plus day management (rename, add training/rest day, reorder,
 * archive with undo). Removal is a soft archive: archived days stay in the array so the parent
 * saves them back and an undo can un-archive within the toast window.
 */
export function RoutineDaysEditor({
  days,
  setDays,
  activeDay,
  onActiveDayChange,
  equipment = [],
  /** Weekly mode: add/remove days. Rotating: day count is locked — reorder + edit only. */
  allowDayMutations = true,
}: {
  days: RoutineDay[]
  setDays: React.Dispatch<React.SetStateAction<RoutineDay[]>>
  activeDay: string
  onActiveDayChange: (id: string) => void
  equipment?: Equipment[]
  allowDayMutations?: boolean
}) {
  const { exercises, byId } = useExercises()
  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [draftLabel, setDraftLabel] = React.useState("")

  const visible = React.useMemo(() => activeDays(days), [days])

  // The parent's activeDay can point at a day that was just archived (or at nothing at all on
  // a freshly seeded routine) — keep the selection on something that actually renders.
  React.useEffect(() => {
    if (visible.length === 0) return
    if (!visible.some((d) => d.id === activeDay)) onActiveDayChange(visible[0].id)
  }, [visible, activeDay, onActiveDayChange])

  function updateExercise(
    dayId: string,
    exerciseId: string,
    patch: Partial<{ targetSets: number; targetReps: string; trackWeight: boolean }>,
  ) {
    setDays((prev) =>
      prev.map((d) =>
        d.id !== dayId
          ? d
          : { ...d, exercises: d.exercises.map((e) => (e.exerciseId === exerciseId ? { ...e, ...patch } : e)) },
      ),
    )
  }

  function removeExercise(dayId: string, exerciseId: string) {
    setDays((prev) =>
      prev.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              exercises: d.exercises
                .filter((e) => e.exerciseId !== exerciseId)
                .map((e, i) => ({ ...e, orderIndex: i })),
            },
      ),
    )
  }

  function addExercise(dayId: string, exerciseId: string) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId || d.dayType === "rest") return d
        if (d.exercises.some((e) => e.exerciseId === exerciseId)) return d
        return {
          ...d,
          exercises: [
            ...d.exercises,
            {
              exerciseId,
              targetSets: 3,
              targetReps: "10",
              orderIndex: d.exercises.length,
              trackWeight: !isLikelyBodyweightExercise(exercises?.find((e) => e.id === exerciseId)),
            },
          ],
        }
      }),
    )
  }

  function addDay(dayType: "training" | "rest") {
    const id = crypto.randomUUID()
    setDays((prev) => {
      const active = activeDays(prev)
      const label =
        dayType === "rest"
          ? "Rest"
          : `Day ${active.filter((d) => d.dayType !== "rest").length + 1}`
      const last = active.length > 0 ? active[active.length - 1].orderIndex + 1 : 0
      return reindexActive([
        ...prev,
        normalizeRoutineDay({ id, label, dayType, orderIndex: last, exercises: [] }, last),
      ])
    })
    onActiveDayChange(id)
  }

  function renameDay(dayId: string, label: string) {
    const trimmed = label.trim()
    if (!trimmed) return
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, label: trimmed } : d)))
  }

  function restoreDay(dayId: string) {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, archivedAt: null } : d)))
    onActiveDayChange(dayId)
  }

  function removeDay(day: RoutineDay) {
    const index = visible.findIndex((d) => d.id === day.id)
    const neighbour = visible[index + 1] ?? visible[index - 1]
    setDays((prev) => prev.map((d) => (d.id === day.id ? { ...d, archivedAt: Date.now() } : d)))
    if (neighbour) onActiveDayChange(neighbour.id)
    toast(`${day.label} removed`, {
      duration: UNDO_WINDOW_MS,
      action: { label: "Undo", onClick: () => restoreDay(day.id) },
    })
  }

  function moveDay(dayId: string, direction: -1 | 1) {
    setDays((prev) => {
      const active = activeDays(prev)
      const index = active.findIndex((d) => d.id === dayId)
      const target = index + direction
      if (index === -1 || target < 0 || target >= active.length) return prev
      const reordered = active.slice()
      ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
      const archived = prev.filter((d) => d.archivedAt != null)
      // Renumber before returning: sorting by the stale orderIndex would undo the swap.
      return [...reordered.map((d, i) => normalizeRoutineDay({ ...d, orderIndex: i }, i)), ...archived]
    })
  }

  function moveExercise(dayId: string, exerciseId: string, direction: -1 | 1) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d
        const sorted = d.exercises
          .slice()
          .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        const index = sorted.findIndex((e) => e.exerciseId === exerciseId)
        const target = index + direction
        if (index === -1 || target < 0 || target >= sorted.length) return d
        const next = sorted.slice()
        ;[next[index], next[target]] = [next[target], next[index]]
        return {
          ...d,
          exercises: next.map((e, i) => ({ ...e, orderIndex: i })),
        }
      }),
    )
  }

  function startRename(day: RoutineDay) {
    setRenamingId(day.id)
    setDraftLabel(day.label)
  }

  function commitRename() {
    if (renamingId) renameDay(renamingId, draftLabel)
    setRenamingId(null)
  }

  const toolbar = allowDayMutations ? (
    <div className="flex gap-2">
      <Button variant="outline" className="h-9 flex-1 text-xs" onClick={() => addDay("training")}>
        <Plus className="size-3.5" /> Add training day
      </Button>
      <Button variant="outline" className="h-9 flex-1 text-xs" onClick={() => addDay("rest")}>
        <Moon className="size-3.5" /> Add rest day
      </Button>
    </div>
  ) : (
    <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      Rotating cycle locks the day count to your N-on / M-off pattern — reorder days or edit
      exercises, but add/remove is disabled here.
    </p>
  )

  if (visible.length === 0) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No days yet — add a training or rest day to start building the split.
        </p>
        {toolbar}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Tabs value={activeDay} onValueChange={onActiveDayChange}>
        <TabsList className="w-full">
          {visible.map((d) => (
            <TabsTrigger key={d.id} value={d.id} className="h-full text-sm">
              {d.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {visible.map((day, index) => (
          <TabsContent key={day.id} value={day.id} className="mt-4 space-y-3">
            <div className="flex items-center gap-1.5">
              {renamingId === day.id ? (
                <>
                  <Input
                    autoFocus
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename()
                      if (e.key === "Escape") setRenamingId(null)
                    }}
                    aria-label="Day name"
                    className="h-9 flex-1 text-sm"
                  />
                  <Button variant="ghost" size="icon" className="size-9" onClick={commitRename} aria-label="Save day name">
                    <Check className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startRename(day)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1 text-left text-sm font-medium hover:text-primary"
                  >
                    <span className="truncate">{day.label}</span>
                    {day.dayType === "rest" ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Rest
                      </Badge>
                    ) : null}
                    <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    disabled={index === 0}
                    onClick={() => moveDay(day.id, -1)}
                    aria-label={`Move ${day.label} earlier`}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    disabled={index === visible.length - 1}
                    onClick={() => moveDay(day.id, 1)}
                    aria-label={`Move ${day.label} later`}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  {allowDayMutations ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeDay(day)}
                      aria-label={`Remove ${day.label}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </>
              )}
            </div>

            {day.dayType === "rest" ? (
              <Card className="border-dashed py-6">
                <CardContent className="flex flex-col items-center gap-1.5 text-center">
                  <Moon className="size-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Rest day — no exercises</p>
                  <p className="text-xs text-muted-foreground">
                    Counts as a slot in the cycle, so the split keeps its rhythm.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {day.exercises
                  .slice()
                  .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                  .map((re, exIndex, sorted) => {
                  const ex = byId(re.exerciseId)
                  if (!ex) return null
                  return (
                    <Card key={re.exerciseId} className="py-3">
                      <CardContent className="space-y-3 px-3.5">
                        <div className="flex items-start gap-3">
                          <ExerciseMediaQuickView
                            exercise={ex}
                            className="w-20 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium leading-tight">{ex.name}</p>
                              <div className="flex shrink-0 items-center gap-0.5">
                                <button
                                  type="button"
                                  aria-label={`Move ${ex.name} up`}
                                  disabled={exIndex === 0}
                                  onClick={() => moveExercise(day.id, re.exerciseId, -1)}
                                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                                >
                                  <ArrowUp className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Move ${ex.name} down`}
                                  disabled={exIndex === sorted.length - 1}
                                  onClick={() => moveExercise(day.id, re.exerciseId, 1)}
                                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                                >
                                  <ArrowDown className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Remove ${ex.name}`}
                                  onClick={() => removeExercise(day.id, re.exerciseId)}
                                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {re.trackWeight === false
                                ? "Bodyweight — no load asked during the workout."
                                : "Weight is suggested at workout time from your last session (+2.5kg)."}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                updateExercise(day.id, re.exerciseId, {
                                  trackWeight: re.trackWeight === false,
                                })
                              }
                              className="mt-1.5 text-xs font-medium text-primary underline-offset-2 hover:underline"
                            >
                              {re.trackWeight === false ? "Track weight instead" : "No weight needed"}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <StepperField
                            label="Sets"
                            value={re.targetSets}
                            onChange={(v) => updateExercise(day.id, re.exerciseId, { targetSets: v })}
                            min={1}
                          />
                          <StepperField
                            label="Reps"
                            value={parseLeadingInt(re.targetReps, 10)}
                            onChange={(v) => updateExercise(day.id, re.exerciseId, { targetReps: String(v) })}
                            min={1}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}

                <AddExerciseSheet
                  mode="pick-exercise"
                  dayLabel={day.label}
                  exercises={exercises ?? []}
                  equipment={equipment}
                  excludeIds={day.exercises.map((e) => e.exerciseId)}
                  onAdd={(id) => addExercise(day.id, id)}
                />
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {toolbar}
    </div>
  )
}

function StepperField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <NumberStepper value={value} onChange={onChange} min={min} step={step} suffix={suffix} size="compact" />
    </div>
  )
}
