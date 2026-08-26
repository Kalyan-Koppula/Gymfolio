import * as React from "react"
import { ChevronDown, ChevronUp, History, Plus, Trash2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { NumberStepper } from "@/components/shared/number-stepper"
import { ExerciseThumb } from "@/components/shared/exercise-thumb"
import { ExerciseMediaPlayer } from "@/components/shared/exercise-media-player"
import {
  describeDayFocus,
  filterExercisesForDay,
  suggestNextWeight,
  type Equipment,
  type RoutineDay,
} from "@/lib/stub-data"
import { useExercises } from "@/hooks/use-exercises"
import type { Exercise } from "shared"

function parseLeadingInt(s: string, fallback: number) {
  const m = s.match(/\d+/)
  return m ? Number(m[0]) : fallback
}

/**
 * Day-tabs + per-exercise editor. Add-exercise sheet filters by day focus (Push/Pull/Upper/…)
 * and shows animated previews on demand.
 */
export function RoutineDaysEditor({
  days,
  setDays,
  activeDay,
  onActiveDayChange,
  equipment = [],
}: {
  days: RoutineDay[]
  setDays: React.Dispatch<React.SetStateAction<RoutineDay[]>>
  activeDay: string
  onActiveDayChange: (id: string) => void
  equipment?: Equipment[]
}) {
  const { exercises, byId } = useExercises()

  function updateExercise(
    dayId: string,
    exerciseId: string,
    patch: Partial<{ targetSets: number; targetReps: string; targetWeightKg: number | null }>,
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
      prev.map((d) => (d.id !== dayId ? d : { ...d, exercises: d.exercises.filter((e) => e.exerciseId !== exerciseId) })),
    )
  }

  function addExercise(dayId: string, exerciseId: string) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d
        if (d.exercises.some((e) => e.exerciseId === exerciseId)) return d
        return {
          ...d,
          exercises: [...d.exercises, { exerciseId, targetSets: 3, targetReps: "10", targetWeightKg: 20 }],
        }
      }),
    )
  }

  if (days.length === 0) return null

  return (
    <Tabs value={activeDay} onValueChange={onActiveDayChange}>
      <TabsList className="w-full">
        {days.map((d) => (
          <TabsTrigger key={d.id} value={d.id} className="h-full text-sm">
            {d.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {days.map((day) => (
        <TabsContent key={day.id} value={day.id} className="mt-4 space-y-3">
          {day.exercises.map((re) => {
            const ex = byId(re.exerciseId)
            if (!ex) return null
            const suggested = suggestNextWeight(re)
            return (
              <Card key={re.exerciseId} className="py-3">
                <CardContent className="space-y-3 px-3.5">
                  <div className="flex items-start gap-3">
                    <ExerciseThumb hasGif={ex.hasGif} exerciseId={ex.id} className="w-14 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{ex.name}</p>
                        <button
                          aria-label={`Remove ${ex.name}`}
                          onClick={() => removeExercise(day.id, re.exerciseId)}
                          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      {re.lastPerformance && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <History className="size-3" />
                          Last time: {re.lastPerformance.reps} × {re.lastPerformance.weightKg}kg
                          {suggested !== re.lastPerformance.weightKg && (
                            <span className="font-medium text-success">→ {suggested}kg suggested</span>
                          )}
                        </p>
                      )}
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
                    <StepperField
                      label="Weight"
                      value={re.targetWeightKg ?? 0}
                      onChange={(v) => updateExercise(day.id, re.exerciseId, { targetWeightKg: v })}
                      step={2.5}
                      suffix="kg"
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}

          <AddExerciseSheet
            dayLabel={day.label}
            exercises={exercises ?? []}
            equipment={equipment}
            excludeIds={day.exercises.map((e) => e.exerciseId)}
            onAdd={(id) => addExercise(day.id, id)}
          />
        </TabsContent>
      ))}
    </Tabs>
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

function AddExerciseSheet({
  dayLabel,
  onAdd,
  exercises,
  equipment,
  excludeIds,
}: {
  dayLabel: string
  onAdd: (exerciseId: string) => void
  exercises: Exercise[]
  equipment: Equipment[]
  excludeIds: string[]
}) {
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [showAll, setShowAll] = React.useState(false)
  const [previewId, setPreviewId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      setQuery("")
      setShowAll(false)
      setPreviewId(null)
    }
  }, [open])

  const { recommended, all } = filterExercisesForDay(exercises, dayLabel, { equipment, excludeIds })
  const q = query.trim().toLowerCase()

  function matchesSearch(ex: Exercise) {
    return !q || ex.name.toLowerCase().includes(q)
  }

  const recommendedFiltered = recommended.filter(matchesSearch)
  const allFiltered = all.filter(matchesSearch)
  const otherFiltered = allFiltered.filter((ex) => !recommended.some((r) => r.id === ex.id))
  const focusLabel = describeDayFocus(dayLabel)

  function pick(id: string) {
    onAdd(id)
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" className="h-11 w-full border-dashed text-sm">
            <Plus className="size-4" /> Add exercise
          </Button>
        }
      />
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Add to {dayLabel}</SheetTitle>
          <p className="text-left text-xs text-muted-foreground">
            Showing exercises for <span className="font-medium text-foreground">{focusLabel}</span>
            {equipment.length > 0 ? " · matching your equipment" : ""}
          </p>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-4">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises…"
            className="h-11 text-base"
          />

          {recommendedFiltered.length > 0 ? (
            <ExercisePickerSection
              title={`Recommended (${recommendedFiltered.length})`}
              items={recommendedFiltered}
              previewId={previewId}
              onPreview={setPreviewId}
              onAdd={pick}
            />
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No matching exercises for this day{q ? " with that search" : ""}.
            </p>
          )}

          {otherFiltered.length > 0 ? (
            <div className="space-y-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-full justify-between px-2 text-sm text-muted-foreground"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Hide all exercises" : `Show all exercises (${otherFiltered.length} more)`}
                {showAll ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
              {showAll ? (
                <ExercisePickerSection
                  title="All exercises"
                  items={otherFiltered}
                  previewId={previewId}
                  onPreview={setPreviewId}
                  onAdd={pick}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ExercisePickerSection({
  title,
  items,
  previewId,
  onPreview,
  onAdd,
}: {
  title: string
  items: Exercise[]
  previewId: string | null
  onPreview: (id: string | null) => void
  onAdd: (id: string) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      {items.map((ex) => (
        <ExercisePickerRow
          key={ex.id}
          exercise={ex}
          expanded={previewId === ex.id}
          onTogglePreview={() => onPreview(previewId === ex.id ? null : ex.id)}
          onAdd={() => onAdd(ex.id)}
        />
      ))}
    </div>
  )
}

function ExercisePickerRow({
  exercise,
  expanded,
  onTogglePreview,
  onAdd,
}: {
  exercise: Exercise
  expanded: boolean
  onTogglePreview: () => void
  onAdd: () => void
}) {
  return (
    <div className="rounded-lg border border-transparent hover:border-border">
      <div className="flex items-center gap-2 p-1.5">
        <button
          type="button"
          aria-label={`Preview ${exercise.name}`}
          onClick={onTogglePreview}
          className="shrink-0 rounded-md ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ExerciseThumb hasGif={exercise.hasGif} exerciseId={exercise.id} className="w-14" />
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="min-w-0 flex-1 py-1 text-left text-sm leading-snug hover:underline"
        >
          {exercise.name}
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {expanded ? (
            <Badge variant="secondary" className="text-[10px]">
              Preview
            </Badge>
          ) : null}
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onAdd} aria-label={`Add ${exercise.name}`}>
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
      {expanded ? (
        <div className="border-t border-border px-2 pb-2 pt-1">
          <ExerciseMediaPlayer exerciseId={exercise.id} hasGif={exercise.hasGif} />
          <Button type="button" className="mt-2 h-10 w-full" onClick={onAdd}>
            Add {exercise.name}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
